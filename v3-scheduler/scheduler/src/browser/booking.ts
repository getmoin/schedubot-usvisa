import { getPage } from './init';
import { handleSessionError, isSessionExpired } from './session';
import { config } from '../config/env';
import { createModuleLogger, log } from '../utils/logger';
import { logAppointmentCheck, logBookingAttempt, getCurrentAppointment, updateCurrentAppointment } from '../database/queries';
import { sleep } from '../utils/time';

const logger = createModuleLogger('Booking');

const MAX_RETRIES = config.booking.maxRetries;

// ========================================
// Types
// ========================================

interface AppointmentData {
  facilityId: number;
  facilityName: string;
  date: string;
}

interface TimeSlotsData {
  available_times: string[];
}

// ========================================
// API Calls (using Playwright page.evaluate for fetch)
// ========================================

/**
 * Get available appointment times for a specific date and facility
 */
async function getAppointmentTimes(
  userId: string,
  facilityId: number,
  date: string,
  retries: number = 3
): Promise<TimeSlotsData | null> {
  const page = getPage();
  const country = config.visa.countryCode;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log.info(`📡 Fetching time slots for ${date} at facility ${facilityId} (attempt ${attempt}/${retries})`);

      const url = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/times/${facilityId}.json?date=${date}&appointments[expedite]=false`;

      // Use page.evaluate to make fetch call with browser's session
      const result = await page.evaluate(async (fetchUrl) => {
        const response = await fetch(fetchUrl, {
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-GB,en;q=0.9',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          return { error: true, status: response.status, statusText: response.statusText };
        }

        const data = await response.json();
        return { error: false, data };
      }, url);

      if (result.error) {
        if (isSessionExpired(result.status as number)) {
          await handleSessionError(new Error(`HTTP ${result.status}: ${result.statusText}`));
        }
        throw new Error(`HTTP ${result.status}: ${result.statusText}`);
      }

      const timesData = result.data as TimeSlotsData;
      log.success(`✅ Found ${timesData.available_times?.length || 0} time slots`);
      return timesData;
    } catch (error: any) {
      logger.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) {
        logger.error(`❌ All ${retries} attempts failed for ${date}`);
        return null;
      }
      await sleep(attempt * 1000);
    }
  }

  return null;
}

/**
 * Check facility for available appointments
 */
async function checkFacilityForAppointments(
  userId: string,
  facilityId: number,
  facilityName: string,
  currentDate: Date,
  startDateFilter?: Date,
  endDateFilter?: Date
): Promise<AppointmentData | null> {
  const page = getPage();
  const country = config.visa.countryCode;
  const startTime = Date.now();

  try {
    const url = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/days/${facilityId}.json?appointments[expedite]=false`;

    log.check(`Checking ${facilityName}...`);

    const result = await page.evaluate(async (fetchUrl) => {
      const response = await fetch(fetchUrl, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-GB,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return { error: true, status: response.status, statusText: response.statusText };
      }

      const data = await response.json();
      return { error: false, data };
    }, url);

    if (result.error) {
      if (isSessionExpired(result.status as number)) {
        await handleSessionError(new Error(`HTTP ${result.status}: ${result.statusText}`));
      }

      await logAppointmentCheck({
        facilityId,
        facilityName,
        checkDurationMs: Date.now() - startTime,
        status: 'error',
        errorMessage: `HTTP ${result.status}`,
      });

      return null;
    }

    const daysData = result.data;

    if (!Array.isArray(daysData) || daysData.length === 0) {
      log.info(`${facilityName}: No appointments available`);

      await logAppointmentCheck({
        facilityId,
        facilityName,
        checkDurationMs: Date.now() - startTime,
        status: 'no_slots',
      });

      return null;
    }

    // Get first available date
    const firstAvailable = daysData[0];
    const availableDate = new Date(firstAvailable.date);

    // Check if it's earlier than current appointment
    const isEarlier = availableDate < currentDate;

    // Check if it's within date range filter
    let inRange = true;
    if (startDateFilter && endDateFilter) {
      inRange = availableDate >= startDateFilter && availableDate <= endDateFilter;
    }

    if (isEarlier && inRange) {
      log.found(`*** ${facilityName}: FOUND BETTER DATE - ${firstAvailable.date} ***`);

      await logAppointmentCheck({
        facilityId,
        facilityName,
        earliestDate: firstAvailable.date,
        checkDurationMs: Date.now() - startTime,
        status: 'success',
      });

      return {
        facilityId,
        facilityName,
        date: firstAvailable.date,
      };
    } else {
      log.info(`${facilityName}: Date ${firstAvailable.date} is not better`);

      await logAppointmentCheck({
        facilityId,
        facilityName,
        earliestDate: firstAvailable.date,
        checkDurationMs: Date.now() - startTime,
        status: 'no_slots',
      });

      return null;
    }
  } catch (error: any) {
    logger.error(`Error checking facility ${facilityId}:`, error);

    await logAppointmentCheck({
      facilityId,
      facilityName,
      checkDurationMs: Date.now() - startTime,
      status: 'error',
      errorMessage: error.message,
    });

    return null;
  }
}

/**
 * Attempt to book an appointment (with retry and multiple time slots)
 */
async function attemptBooking(
  userId: string,
  appointment: AppointmentData,
  retryCount: number = 0
): Promise<boolean> {
  const page = getPage();
  const attemptNumber = retryCount + 1;

  log.booking(`🎯 BOOKING ATTEMPT ${attemptNumber}/${MAX_RETRIES} - ${appointment.facilityName} on ${appointment.date}`);

  await logBookingAttempt({
    facilityId: appointment.facilityId,
    facilityName: appointment.facilityName,
    targetDate: appointment.date,
    attemptNumber,
    status: 'trying',
  });

  try {
    // Navigate to appointment page if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/appointment')) {
      const appointmentUrl = `https://ais.usvisa-info.com/${config.visa.countryCode}/niv/schedule/${userId}/appointment`;
      await page.goto(appointmentUrl, { waitUntil: 'networkidle' });
    }

    // Update facility dropdown
    const facilityDropdown = page.locator('#appointments_consulate_appointment_facility_id');
    if (await facilityDropdown.isVisible()) {
      await facilityDropdown.selectOption(appointment.facilityId.toString());
      await sleep(500);
    }

    // Update date field
    const dateField = page.locator('#appointments_consulate_appointment_date');
    await dateField.fill(appointment.date);
    await dateField.click();
    await sleep(1000);

    // Fetch available times
    const timesData = await getAppointmentTimes(userId, appointment.facilityId, appointment.date);

    if (!timesData || !timesData.available_times || timesData.available_times.length === 0) {
      throw new Error('No time slots available for this date');
    }

    log.info(`✓ Found ${timesData.available_times.length} time slot(s): ${timesData.available_times.join(', ')}`);

    // V2 Enhancement: Try ALL available time slots
    for (let timeIndex = 0; timeIndex < timesData.available_times.length; timeIndex++) {
      const timeSlot = timesData.available_times[timeIndex];
      log.info(`Trying time slot ${timeIndex + 1}/${timesData.available_times.length}: ${timeSlot}`);

      try {
        const timeDropdown = page.locator('#appointments_consulate_appointment_time');

        // Clear and set new time
        await timeDropdown.selectOption(timeSlot);
        log.info(`Selected time: ${timeSlot}`);

        // Submit form
        const submitButton = page.locator('#appointments_submit');
        await submitButton.click();

        // Wait for confirmation dialog
        await sleep(1500);

        // Look for confirmation button
        const confirmButton = page.locator('a.alert').first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          log.success('✅ BOOKING SUCCESSFUL! Confirming...');

          await logBookingAttempt({
            facilityId: appointment.facilityId,
            facilityName: appointment.facilityName,
            targetDate: appointment.date,
            timeSlot,
            attemptNumber,
            status: 'success',
          });

          // Click confirm
          await confirmButton.click();
          await sleep(3000);

          // Update current appointment in database
          await updateCurrentAppointment(
            appointment.facilityId,
            appointment.facilityName,
            appointment.date,
            timeSlot
          );

          log.success(`✅ BOOKING CONFIRMED: ${appointment.facilityName} on ${appointment.date} at ${timeSlot}`);

          return true; // Success!
        }

        // If no confirm button, try next time slot
        log.warn(`Time slot ${timeSlot} didn't work, trying next...`);
      } catch (timeSlotError: any) {
        log.warn(`Error with time slot ${timeSlot}: ${timeSlotError.message}`);
        // Continue to next time slot
      }
    }

    // If we exhausted all time slots
    throw new Error('All time slots failed or were unavailable');
  } catch (error: any) {
    log.error(`❌ Booking attempt ${attemptNumber} failed: ${error.message}`);

    await logBookingAttempt({
      facilityId: appointment.facilityId,
      facilityName: appointment.facilityName,
      targetDate: appointment.date,
      attemptNumber,
      status: 'failed',
      errorMessage: error.message,
    });

    // Retry if we haven't exceeded max retries
    if (attemptNumber < MAX_RETRIES) {
      log.retry(`Retrying in 2 seconds... (${attemptNumber}/${MAX_RETRIES})`);
      await sleep(2000);
      return await attemptBooking(userId, appointment, attemptNumber);
    } else {
      log.error(`❌ BOOKING FAILED after ${MAX_RETRIES} attempts`);
      return false;
    }
  }
}

// ========================================
// Main Exported Functions
// ========================================

/**
 * Check all facilities and book if better appointment found
 */
export async function checkAndBook(userId: string): Promise<boolean> {
  log.check('🔍 Starting facility check...');
  log.check('='.repeat(50));

  // Get current appointment
  const currentAppt = await getCurrentAppointment();
  const currentDate = currentAppt
    ? new Date(currentAppt.appointmentDate)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Far future if none

  log.info(`Current appointment: ${currentDate.toDateString()}`);

  // Get facilities to check
  const facilities = config.facilities;
  const facilityMap = config.facilityMap;

  log.info(`Checking ${facilities.length} location(s): ${facilities.map((id) => facilityMap[id]).join(', ')}`);

  // Check all facilities in parallel (V2 enhancement)
  const checkPromises = facilities.map((facilityId) =>
    checkFacilityForAppointments(
      userId,
      facilityId,
      facilityMap[facilityId],
      currentDate,
      config.booking.startDateFilter,
      config.booking.endDateFilter
    )
  );

  const results = await Promise.allSettled(checkPromises);

  // Find best appointment from all results
  let bestAppointment: AppointmentData | null = null;
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value !== null) {
      const appointment = result.value as AppointmentData;
      if (!bestAppointment || new Date(appointment.date) < new Date(bestAppointment.date)) {
        bestAppointment = appointment;
      }
    }
  });

  // If we found a better appointment, book it
  if (bestAppointment !== null) {
    const appointment: AppointmentData = bestAppointment;
    log.found('🎉 *** BETTER APPOINTMENT FOUND ***');
    log.found(`📍 Location: ${appointment.facilityName}`);
    log.found(`📅 Date: ${appointment.date}`);
    log.found('='.repeat(50));

    const bookingSuccess = await attemptBooking(userId, appointment);

    if (bookingSuccess) {
      log.success('✅ BOOKING SUCCESSFUL - Will check again for even better dates!');
      return true;
    } else {
      log.warn('⚠️ Booking failed, will continue checking for appointments');
      return false;
    }
  } else {
    log.info('ℹ️ No better appointments found');
    log.info('='.repeat(50));
    return false;
  }
}
