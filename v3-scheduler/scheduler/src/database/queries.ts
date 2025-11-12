import { query, transaction } from './client';
import { encrypt, decrypt } from '../utils/crypto';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('Queries');

// ========================================
// Type Definitions
// ========================================

export interface Credentials {
  id: number;
  email: string;
  password: string; // Decrypted
  country: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentCheck {
  id?: number;
  checkTime?: Date;
  facilityId: number;
  facilityName: string;
  earliestDate?: string;
  availableSlots?: string[];
  checkDurationMs: number;
  status: 'success' | 'no_slots' | 'error';
  errorMessage?: string;
}

export interface BookingAttempt {
  id?: number;
  attemptTime?: Date;
  facilityId: number;
  facilityName: string;
  targetDate: string;
  timeSlot?: string;
  attemptNumber: number;
  status: 'trying' | 'success' | 'failed';
  errorMessage?: string;
  durationMs?: number;
}

export interface CurrentAppointment {
  id?: number;
  appointmentDate: string;
  facilityId: number;
  facilityName: string;
  timeSlot?: string;
  bookedAt?: Date;
  isActive: boolean;
}

export interface Session {
  id?: number;
  cookies: any[];
  userAgent?: string;
  createdAt?: Date;
  lastValidated?: Date;
  isValid: boolean;
}

// ========================================
// Credentials
// ========================================

export async function saveCredentials(
  email: string,
  password: string,
  country: string,
  userId?: string
): Promise<void> {
  const encryptedPassword = encrypt(password);

  await query(
    `INSERT INTO credentials (email, password_encrypted, country, user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET password_encrypted = $2, country = $3, user_id = $4, updated_at = CURRENT_TIMESTAMP`,
    [email, encryptedPassword, country, userId]
  );

  logger.info(`Credentials saved for ${email}`);
}

export async function getCredentials(): Promise<Credentials | null> {
  const result = await query<any>(
    'SELECT * FROM credentials ORDER BY created_at DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    password: decrypt(row.password_encrypted),
    country: row.country,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========================================
// Appointment Checks
// ========================================

export async function logAppointmentCheck(check: AppointmentCheck): Promise<void> {
  await query(
    `INSERT INTO appointment_checks
     (facility_id, facility_name, earliest_date, available_slots, check_duration_ms, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      check.facilityId,
      check.facilityName,
      check.earliestDate || null,
      check.availableSlots ? JSON.stringify(check.availableSlots) : null,
      check.checkDurationMs,
      check.status,
      check.errorMessage || null,
    ]
  );
}

export async function getRecentChecks(limit: number = 50): Promise<AppointmentCheck[]> {
  const result = await query<any>(
    `SELECT * FROM appointment_checks
     ORDER BY check_time DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    checkTime: row.check_time,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    earliestDate: row.earliest_date,
    availableSlots: row.available_slots,
    checkDurationMs: row.check_duration_ms,
    status: row.status,
    errorMessage: row.error_message,
  }));
}

// ========================================
// Booking Attempts
// ========================================

export async function logBookingAttempt(attempt: BookingAttempt): Promise<void> {
  await query(
    `INSERT INTO booking_attempts
     (facility_id, facility_name, target_date, time_slot, attempt_number, status, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      attempt.facilityId,
      attempt.facilityName,
      attempt.targetDate,
      attempt.timeSlot || null,
      attempt.attemptNumber,
      attempt.status,
      attempt.errorMessage || null,
      attempt.durationMs || null,
    ]
  );
}

export async function getBookingHistory(limit: number = 50): Promise<BookingAttempt[]> {
  const result = await query<any>(
    `SELECT * FROM booking_attempts
     ORDER BY attempt_time DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    attemptTime: row.attempt_time,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    targetDate: row.target_date,
    timeSlot: row.time_slot,
    attemptNumber: row.attempt_number,
    status: row.status,
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
  }));
}

// ========================================
// Current Appointment
// ========================================

export async function getCurrentAppointment(): Promise<CurrentAppointment | null> {
  const result = await query<any>(
    `SELECT * FROM current_appointment
     WHERE is_active = true
     ORDER BY booked_at DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    appointmentDate: row.appointment_date,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    timeSlot: row.time_slot,
    bookedAt: row.booked_at,
    isActive: row.is_active,
  };
}

export async function updateCurrentAppointment(
  facilityId: number,
  facilityName: string,
  date: string,
  timeSlot?: string
): Promise<void> {
  await transaction(async (client) => {
    // Deactivate all previous appointments
    await client.query('UPDATE current_appointment SET is_active = false WHERE is_active = true');

    // Insert new appointment
    await client.query(
      `INSERT INTO current_appointment (appointment_date, facility_id, facility_name, time_slot, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [date, facilityId, facilityName, timeSlot || null]
    );
  });

  logger.info(`✅ Current appointment updated: ${facilityName} on ${date}`);
}

// ========================================
// Sessions
// ========================================

export async function saveSession(cookies: any[], userAgent?: string): Promise<void> {
  await transaction(async (client) => {
    // Invalidate all previous sessions
    await client.query('UPDATE sessions SET is_valid = false WHERE is_valid = true');

    // Insert new session
    await client.query(
      `INSERT INTO sessions (cookies, user_agent, is_valid)
       VALUES ($1, $2, true)`,
      [JSON.stringify(cookies), userAgent || null]
    );
  });

  logger.info('Session saved to database');
}

export async function getSession(): Promise<Session | null> {
  const result = await query<any>(
    `SELECT * FROM sessions
     WHERE is_valid = true
     ORDER BY created_at DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    cookies: JSON.parse(row.cookies),
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastValidated: row.last_validated,
    isValid: row.is_valid,
  };
}

export async function invalidateSession(): Promise<void> {
  await query('UPDATE sessions SET is_valid = false WHERE is_valid = true');
  logger.info('All sessions invalidated');
}

export async function updateSessionValidation(): Promise<void> {
  await query(
    'UPDATE sessions SET last_validated = CURRENT_TIMESTAMP WHERE is_valid = true'
  );
}

// ========================================
// App State
// ========================================

export async function getAppState(key: string): Promise<any | null> {
  const result = await query<any>('SELECT value FROM app_state WHERE key = $1', [key]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].value;
}

export async function setAppState(key: string, value: any): Promise<void> {
  await query(
    `INSERT INTO app_state (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key)
     DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(value)]
  );
}

// ========================================
// Error Logs
// ========================================

export async function logError(
  errorType: string,
  errorMessage: string,
  stackTrace?: string,
  context?: any,
  severity: string = 'error'
): Promise<void> {
  await query(
    `INSERT INTO error_logs (error_type, error_message, stack_trace, context, severity)
     VALUES ($1, $2, $3, $4, $5)`,
    [errorType, errorMessage, stackTrace || null, context ? JSON.stringify(context) : null, severity]
  );
}

export async function getRecentErrors(limit: number = 20): Promise<any[]> {
  const result = await query<any>(
    `SELECT * FROM error_logs
     ORDER BY error_time DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
