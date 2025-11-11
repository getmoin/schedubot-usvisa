import { checkAndBook } from '../browser/booking';
import { ensureValidSession } from '../browser/session';
import { getCredentials } from '../database/queries';
import { createModuleLogger, log } from '../utils/logger';
import { sleep, getRandomDelay, isWithinCheckingWindow } from '../utils/time';
import { config } from '../config/env';

const logger = createModuleLogger('Loop');

/**
 * Main checking loop - checks facilities and books if better date found
 * This is called by the cron scheduler
 */
export async function runCheckingLoop(): Promise<void> {
  try {
    // Ensure session is valid
    await ensureValidSession();

    // Get userId
    const creds = await getCredentials();
    if (!creds || !creds.userId) {
      throw new Error('User ID not found in database');
    }

    const userId = creds.userId;

    // Run check and book
    const booked = await checkAndBook(userId);

    if (booked) {
      log.success('🎉 Successfully booked appointment!');
      log.info('⏰ Will check again immediately for even better dates...');

      // Wait a bit, then check again
      await sleep(5000);

      // Recursive call to check again immediately
      await runCheckingLoop();
    } else {
      log.info('✅ Check cycle completed');
    }
  } catch (error: any) {
    logger.error('Error in checking loop:', error);

    // Log error but don't throw - we want to continue checking
    if (error.message.includes('401') || error.message.includes('session')) {
      log.retry('Session error detected, will retry on next scheduled run');
    }
  }
}

/**
 * V2-style continuous loop with randomized delays
 * Matches V2 extension behavior: 5-30 second random delays, continuous checking
 * Respects time window (7pm-5am EST)
 */
export async function runContinuousLoop(): Promise<void> {
  log.success('🔄 Starting V2-style continuous checking loop...');
  log.info(`📊 Randomized delays: ${config.schedule.minDelaySec}-${config.schedule.maxDelaySec} seconds`);
  log.info(`📊 Expected frequency: ~${Math.floor(60 / ((config.schedule.minDelaySec + config.schedule.maxDelaySec) / 2))} checks per minute`);
  log.info(`⏰ Time window: ${config.schedule.startHour}:00-${config.schedule.endHour}:00 EST`);
  log.info('='.repeat(60));

  while (true) {
    try {
      // Check if we're within the time window
      if (!isWithinCheckingWindow()) {
        log.warn(`⏰ Outside checking window (${config.schedule.startHour}:00-${config.schedule.endHour}:00 EST)`);
        log.info('Waiting 5 minutes before checking again...');
        await sleep(5 * 60 * 1000); // Wait 5 minutes
        continue;
      }

      // Add small random delay at start (0-5 sec) to avoid perfect timing patterns
      const startDelay = Math.floor(Math.random() * 5000);
      await sleep(startDelay);

      // Run the checking loop
      await runCheckingLoop();

      // V2-style: Random delay between checks (5-30 seconds by default)
      const randomDelay = getRandomDelay();
      const delaySec = Math.floor(randomDelay / 1000);
      log.info(`⏰ Next check in ${delaySec} seconds (randomized)...`);
      await sleep(randomDelay);

    } catch (error) {
      logger.error('Error in continuous loop:', error);

      // On error, wait a bit before retrying
      log.warn('Error occurred, waiting 10 seconds before retry...');
      await sleep(10000);
    }
  }
}
