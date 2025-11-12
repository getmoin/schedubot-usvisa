#!/usr/bin/env node

import { config, validateConfig } from './config/env';
import { initDatabase, closeDatabase } from './database/client';
import { saveCredentials, getCurrentAppointment } from './database/queries';
import { logger, log } from './utils/logger';
import { initBrowser, closeBrowser } from './browser/init';
import { ensureLoggedIn } from './browser/login';
import { runContinuousLoop } from './scheduler/loop';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  log.success('🚀 USA Visa Scheduler V3 Starting...');
  log.success('='.repeat(60));

  try {
    // Step 1: Validate configuration
    log.info('Step 1: Validating configuration...');
    validateConfig();
    log.success('✅ Configuration valid');

    // Step 2: Initialize database
    log.info('Step 2: Connecting to database...');
    await initDatabase();
    log.success('✅ Database connected');

    // Step 3: Save credentials to database (encrypted)
    log.info('Step 3: Saving credentials...');
    await saveCredentials(
      config.visa.email,
      config.visa.password,
      config.visa.countryCode,
      config.visa.userId
    );
    log.success('✅ Credentials saved (encrypted)');

    // Step 4: Initialize browser
    log.info('Step 4: Initializing headless browser...');
    await initBrowser();
    log.success('✅ Browser initialized');

    // Step 5: Login to visa portal
    log.info('Step 5: Logging in to visa portal...');
    const userId = await ensureLoggedIn();
    log.success(`✅ Logged in successfully (User ID: ${userId})`);

    // Step 6: Get current appointment
    log.info('Step 6: Checking current appointment...');
    const currentAppt = await getCurrentAppointment();
    if (currentAppt) {
      log.info(`📅 Current appointment: ${currentAppt.facilityName} on ${currentAppt.appointmentDate}`);
    } else {
      log.info('📅 No current appointment found in database');
    }

    // Step 7: Display configuration
    log.success('='.repeat(60));
    log.info('📋 Configuration:');
    log.info(`   Email: ${config.visa.email}`);
    log.info(`   Country: ${config.visa.countryCode}`);
    log.info(`   User ID: ${userId}`);
    log.info(`   Facilities: ${config.facilities.map(id => config.facilityMap[id]).join(', ')}`);
    log.info(`   Check Window: ${config.schedule.startHour}:00 - ${config.schedule.endHour}:00 ${config.schedule.timezone}`);
    log.info(`   Check Frequency: ${config.schedule.minDelaySec}-${config.schedule.maxDelaySec} sec delays (V2-style, randomized)`);
    log.info(`   Expected Rate: ~${Math.floor(60 / ((config.schedule.minDelaySec + config.schedule.maxDelaySec) / 2))} checks/minute`);
    log.info(`   Max Booking Retries: ${config.booking.maxRetries}`);
    if (config.booking.startDateFilter) {
      log.info(`   Start Date Filter: ${config.booking.startDateFilter.toISOString().split('T')[0]}`);
    }
    if (config.booking.endDateFilter) {
      log.info(`   End Date Filter: ${config.booking.endDateFilter.toISOString().split('T')[0]}`);
    }
    log.success('='.repeat(60));

    // Step 8: Display mode
    log.info('Step 8: Starting continuous loop (V2-style)...');
    log.success('='.repeat(60));
    log.success('🎯 V3 Scheduler is now running in CONTINUOUS MODE!');
    log.success('   - V2-style checking: Randomized 5-30 sec delays');
    log.success('   - Time window enforced: 7pm-5am EST only');
    log.success('   - Checking for appointments continuously');
    log.success('   - Will book better dates when found');
    log.success('   - Press Ctrl+C to stop');
    log.success('='.repeat(60));

    // V2-style: Run continuous loop instead of cron
    // This matches V2 extension behavior: continuous checking with random delays
    await runContinuousLoop();
  } catch (error: any) {
    logger.error('❌ Fatal error during startup:', error);
    logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received, shutting down gracefully...`);

  try {
    // Close browser
    log.info('Closing browser...');
    await closeBrowser();

    // Close database
    log.info('Closing database...');
    await closeDatabase();

    log.success('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

// Start the application
main().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
