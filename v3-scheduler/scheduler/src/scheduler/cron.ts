import * as cron from 'node-cron';
import { config } from '../config/env';
import { isWithinCheckingWindow, getCurrentTimeEST, sleep } from '../utils/time';
import { createModuleLogger, log } from '../utils/logger';
import { runCheckingLoop } from './loop';

const logger = createModuleLogger('Cron');

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;

/**
 * Start the cron scheduler
 * Runs every CHECK_INTERVAL_MIN minutes during 7pm-5am EST window
 */
export function startScheduler(): void {
  if (cronJob) {
    logger.warn('Scheduler already running');
    return;
  }

  // NOTE: This cron scheduler is no longer used in V3 (using continuous loop instead)
  // Keeping this file for backward compatibility but not actively used
  const intervalMin = 5; // Legacy default

  // Create cron expression based on interval
  // Format: */interval start-end,start-end * * *
  // Example: */5 19-23,0-5 * * * (every 5 min from 7pm-11:59pm and 12am-5am)
  const cronExpression = `*/${intervalMin} 19-23,0-${config.schedule.endHour} * * *`;

  logger.info(`Starting scheduler with cron: ${cronExpression}`);
  logger.info(`Check window: ${config.schedule.startHour}:00 - ${config.schedule.endHour}:00 EST`);
  logger.info(`Check interval: Every ${intervalMin} minutes`);

  cronJob = cron.schedule(cronExpression, async () => {
    // Double-check we're in the time window
    if (!isWithinCheckingWindow()) {
      logger.warn('Cron triggered outside time window, skipping...');
      return;
    }

    // Prevent concurrent runs
    if (isRunning) {
      logger.warn('Previous check still running, skipping this cycle');
      return;
    }

    isRunning = true;

    try {
      log.info(`⏰ Scheduled check triggered at ${getCurrentTimeEST()}`);
      await runCheckingLoop();
    } catch (error) {
      logger.error('Error in scheduled check:', error);
    } finally {
      isRunning = false;
    }
  }, {
    timezone: config.schedule.timezone,
  });

  cronJob.start();

  log.success('✅ Scheduler started successfully');
  log.info(`Next check will run during time window: ${config.schedule.startHour}:00-${config.schedule.endHour}:00 EST`);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (!cronJob) {
    return;
  }

  logger.info('Stopping scheduler...');
  cronJob.stop();
  cronJob = null;

  log.success('Scheduler stopped');
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return cronJob !== null;
}

/**
 * Wait until time window opens (if currently outside)
 */
export async function waitForTimeWindow(): Promise<void> {
  if (isWithinCheckingWindow()) {
    log.success('✅ Currently within checking window');
    return;
  }

  log.warn('⏰ Outside checking window, waiting...');

  // Calculate minutes until next window
  const now = new Date();
  const hourStr = now.toLocaleString('en-US', {
    timeZone: config.schedule.timezone,
    hour: '2-digit',
    hour12: false,
  });
  const currentHour = parseInt(hourStr, 10);

  const startHour = config.schedule.startHour;
  let hoursUntil: number;

  if (currentHour < startHour) {
    hoursUntil = startHour - currentHour;
  } else {
    hoursUntil = 24 - currentHour + startHour;
  }

  const minutesUntil = hoursUntil * 60;

  log.info(`Will start checking in ${hoursUntil} hours (${minutesUntil} minutes)`);
  log.info(`Window opens at: ${startHour}:00 EST`);

  // Check every 5 minutes if we've entered the window
  while (!isWithinCheckingWindow()) {
    await sleep(5 * 60 * 1000); // 5 minutes

    if (isWithinCheckingWindow()) {
      log.success('✅ Time window opened! Starting checks...');
      break;
    }

    log.info(`Still waiting for window to open (current time: ${getCurrentTimeEST()})`);
  }
}
