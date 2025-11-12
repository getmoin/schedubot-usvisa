import { getPage, navigateTo, saveBrowserSession, takeScreenshot } from './init';
import { getCredentials, saveCredentials } from '../database/queries';
import { config } from '../config/env';
import { createModuleLogger, log } from '../utils/logger';
import { sleep } from '../utils/time';

const logger = createModuleLogger('Login');

/**
 * Login to visa portal
 */
export async function login(): Promise<string> {
  const page = getPage();
  const creds = await getCredentials();

  if (!creds) {
    // First time - save credentials to database
    await saveCredentials(
      config.visa.email,
      config.visa.password,
      config.visa.countryCode,
      config.visa.userId
    );
  }

  const email = creds?.email || config.visa.email;
  const password = creds?.password || config.visa.password;
  const country = creds?.country || config.visa.countryCode;

  log.session('🔐 Logging in to visa portal...');

  // Navigate to login page
  const loginUrl = `https://ais.usvisa-info.com/${country}/niv/users/sign_in`;
  await navigateTo(loginUrl);

  // Wait for login form
  await page.waitForSelector('input[name="user[email]"]', { timeout: 10000 });

  log.session('Filling login form...');

  // Fill email
  await page.fill('input[name="user[email]"]', email);

  // Fill password
  await page.fill('input[name="user[password]"]', password);

  // Check "I agree to terms"
  // V2 extension approach: Set checked property directly via JavaScript
  await page.evaluate(() => {
    const checkbox = (globalThis as any).document.getElementById('policy_confirmed');
    if (checkbox) {
      checkbox.checked = true;
    }
  });
  log.session('✅ Terms checkbox checked');

  // Wait a bit for any JavaScript to process
  await sleep(500);

  // Submit form
  log.session('🔐 Submitting login form...');
  await page.click('input[name="commit"]');

  // Wait for navigation
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Check if login was successful
  const currentUrl = page.url();

  if (currentUrl.includes('sign_in')) {
    // Still on login page - login failed
    await takeScreenshot('login-failed.png');
    throw new Error('Login failed. Check credentials or CAPTCHA required.');
  }

  log.success('✅ Login successful!');

  // Extract userId from URL if not already set
  let userId = config.visa.userId;
  if (!userId) {
    const urlMatch = currentUrl.match(/\/schedule\/(\d+)\//);
    if (urlMatch) {
      userId = urlMatch[1];
      log.info(`Extracted userId from URL: ${userId}`);

      // Save userId to database
      await saveCredentials(email, password, country, userId);
    }
  }

  if (!userId) {
    throw new Error('Failed to extract userId from URL');
  }

  // Save session cookies
  await saveBrowserSession();

  log.success(`✅ Session saved. UserId: ${userId}`);

  return userId;
}

/**
 * Check if currently logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const page = getPage();
  const currentUrl = page.url();

  // If on sign_in page, definitely not logged in
  if (currentUrl.includes('sign_in')) {
    return false;
  }

  // Try to detect login state by checking for common elements
  try {
    // Check if we can access the account page
    const accountUrl = `https://ais.usvisa-info.com/${config.visa.countryCode}/niv/account`;
    await navigateTo(accountUrl);

    const url = page.url();
    if (url.includes('sign_in')) {
      return false;
    }

    // If we're on account page or schedule page, we're logged in
    if (url.includes('/account') || url.includes('/schedule')) {
      return true;
    }

    return false;
  } catch (error) {
    logger.warn('Error checking login state:', error);
    return false;
  }
}

/**
 * Ensure logged in - login if necessary
 */
export async function ensureLoggedIn(): Promise<string> {
  log.session('Checking login state...');

  const loggedIn = await isLoggedIn();

  if (loggedIn) {
    log.success('Already logged in');

    // Try to get userId
    const creds = await getCredentials();
    if (creds?.userId) {
      return creds.userId;
    }

    // Extract from URL
    const page = getPage();
    const urlMatch = page.url().match(/\/schedule\/(\d+)\//);
    if (urlMatch) {
      return urlMatch[1];
    }

    // If still no userId, re-login
    log.warn('Could not determine userId, re-logging in...');
  }

  // Need to login
  return await login();
}

/**
 * Navigate to appointment page
 */
export async function navigateToAppointmentPage(userId: string): Promise<void> {
  const country = config.visa.countryCode;
  const appointmentUrl = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`;

  log.info(`Navigating to appointment page...`);
  await navigateTo(appointmentUrl);

  // Wait for page to load
  await sleep(2000);

  log.success('✅ On appointment page');
}

/**
 * Get current appointment date from page
 */
export async function getCurrentAppointmentFromPage(): Promise<Date | null> {
  const page = getPage();

  try {
    // Look for the current appointment date on the page
    // This is typically in the format: "Your current appointment is on: MMM DD, YYYY"
    const dateText = await page.locator('text=/Your.*appointment.*is.*on/i').textContent();

    if (!dateText) {
      return null;
    }

    // Extract date using regex
    const dateMatch = dateText.match(/(\w+ \d+, \d+)/);
    if (dateMatch) {
      const date = new Date(dateMatch[1]);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  } catch (error) {
    logger.warn('Could not extract current appointment date:', error);
    return null;
  }
}
