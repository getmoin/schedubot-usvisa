import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getSession, saveSession } from '../database/queries';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('Browser');

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

/**
 * Initialize Playwright browser
 */
export async function initBrowser(): Promise<void> {
  if (browser) {
    logger.warn('Browser already initialized');
    return;
  }

  logger.info('Launching headless browser...');

  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
    ],
  });

  // Create browser context
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Try to restore session from database
  const savedSession = await getSession();
  if (savedSession && savedSession.cookies) {
    logger.info('Restoring session from database...');
    try {
      await context.addCookies(savedSession.cookies);
      logger.info('✅ Session restored successfully');
    } catch (error) {
      logger.warn('Failed to restore session, will need fresh login:', error);
    }
  }

  // Create a new page
  page = await context.newPage();

  logger.info('✅ Browser initialized successfully');
}

/**
 * Get current page instance
 */
export function getPage(): Page {
  if (!page) {
    throw new Error('Browser not initialized. Call initBrowser() first.');
  }
  return page;
}

/**
 * Get browser context
 */
export function getContext(): BrowserContext {
  if (!context) {
    throw new Error('Browser context not initialized. Call initBrowser() first.');
  }
  return context;
}

/**
 * Get browser instance
 */
export function getBrowser(): Browser {
  if (!browser) {
    throw new Error('Browser not initialized. Call initBrowser() first.');
  }
  return browser;
}

/**
 * Save current session cookies to database
 */
export async function saveBrowserSession(): Promise<void> {
  if (!context) {
    throw new Error('Browser context not initialized');
  }

  const cookies = await context.cookies();
  const userAgent = await getPage().evaluate(() => navigator.userAgent);

  await saveSession(cookies, userAgent);
  logger.info('Browser session saved to database');
}

/**
 * Close browser gracefully
 */
export async function closeBrowser(): Promise<void> {
  if (!browser) {
    return;
  }

  logger.info('Closing browser...');

  try {
    // Save session before closing
    await saveBrowserSession();
  } catch (error) {
    logger.warn('Failed to save session on close:', error);
  }

  if (page) {
    await page.close();
    page = null;
  }

  if (context) {
    await context.close();
    context = null;
  }

  if (browser) {
    await browser.close();
    browser = null;
  }

  logger.info('Browser closed');
}

/**
 * Navigate to URL with retry logic
 */
export async function navigateTo(url: string, retries: number = 3): Promise<void> {
  const currentPage = getPage();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Navigating to ${url} (attempt ${attempt}/${retries})`);
      await currentPage.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      logger.info('✅ Navigation successful');
      return;
    } catch (error) {
      logger.warn(`Navigation attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        throw new Error(`Failed to navigate to ${url} after ${retries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/**
 * Take screenshot for debugging
 */
export async function takeScreenshot(filename: string): Promise<void> {
  const currentPage = getPage();
  const path = `/app/logs/${filename}`;
  await currentPage.screenshot({ path, fullPage: true });
  logger.info(`Screenshot saved: ${path}`);
}
