import { getPage, saveBrowserSession } from './init';
import { ensureLoggedIn } from './login';
import { updateSessionValidation, invalidateSession, getCredentials } from '../database/queries';
import { createModuleLogger, log } from '../utils/logger';
import { config } from '../config/env';

const logger = createModuleLogger('Session');

let lastValidation = Date.now();
let lastPageRefresh = Date.now();
const VALIDATION_INTERVAL = 10 * 60 * 1000; // 10 minutes
const PAGE_REFRESH_INTERVAL = config.schedule.sessionRefreshMin * 60 * 1000; // From config (default 10 min)

/**
 * Validate session is still active
 */
export async function validateSession(): Promise<boolean> {
  const now = Date.now();

  // Only validate every 10 minutes
  if (now - lastValidation < VALIDATION_INTERVAL) {
    return true;
  }

  log.session('Validating session...');

  try {
    const page = getPage();
    const currentUrl = page.url();

    // If we're on sign_in page, session expired
    if (currentUrl.includes('sign_in')) {
      log.warn('Session expired - on sign_in page');
      return false;
    }

    // Update last validation time
    await updateSessionValidation();
    lastValidation = now;

    log.success('✅ Session valid');
    return true;
  } catch (error) {
    logger.error('Error validating session:', error);
    return false;
  }
}

/**
 * Handle 401 or session errors
 */
export async function handleSessionError(error: Error): Promise<void> {
  const errorMsg = error.message.toLowerCase();

  if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
    log.retry('🔄 401 error detected - refreshing session...');

    // Invalidate current session
    await invalidateSession();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Re-login
    await ensureLoggedIn();

    log.success('✅ Session refreshed successfully');
  }
}

/**
 * Refresh session proactively
 */
export async function refreshSession(): Promise<void> {
  log.session('Refreshing session proactively...');

  try {
    // Save current session
    await saveBrowserSession();

    // Update validation timestamp
    await updateSessionValidation();

    lastValidation = Date.now();

    log.success('✅ Session refreshed');
  } catch (error) {
    logger.error('Error refreshing session:', error);
    throw error;
  }
}

/**
 * Check if response indicates session expired
 */
export function isSessionExpired(statusCode: number): boolean {
  return statusCode === 401 || statusCode === 403;
}

/**
 * Ensure session is valid before operation
 */
export async function ensureValidSession(): Promise<void> {
  const isValid = await validateSession();

  if (!isValid) {
    log.retry('Session invalid, re-logging in...');
    await ensureLoggedIn();
  }

  // V2-style: Periodically refresh page to maintain state
  await checkAndRefreshPage();
}

/**
 * Periodically navigate to appointment page to refresh state (like V2 extension)
 * V2 did this every 10 minutes with window.location.href
 */
export async function checkAndRefreshPage(): Promise<void> {
  const now = Date.now();

  // Only refresh if interval has passed
  if (now - lastPageRefresh < PAGE_REFRESH_INTERVAL) {
    return;
  }

  try {
    log.session(`🔄 Refreshing page navigation (every ${config.schedule.sessionRefreshMin} min, like V2)...`);

    const page = getPage();
    const creds = await getCredentials();

    if (!creds || !creds.userId) {
      logger.warn('No userId found for page refresh');
      return;
    }

    const userId = creds.userId;
    const country = config.visa.countryCode;
    const appointmentUrl = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`;

    // Navigate to appointment page (like V2's window.location.href)
    await page.goto(appointmentUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Save session after navigation
    await saveBrowserSession();
    await updateSessionValidation();

    lastPageRefresh = now;
    lastValidation = now;

    log.success('✅ Page refreshed successfully');
  } catch (error) {
    logger.error('Error refreshing page:', error);
    // Don't throw - non-fatal error
  }
}
