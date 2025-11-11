import { config } from '../config/env';

/**
 * Check if current time is within the checking window (7pm-5am EST)
 * @returns True if within checking window
 */
export function isWithinCheckingWindow(): boolean {
  const now = new Date();

  // Get current hour in the configured timezone
  const hourStr = now.toLocaleString('en-US', {
    timeZone: config.schedule.timezone,
    hour: '2-digit',
    hour12: false,
  });

  const currentHour = parseInt(hourStr, 10);
  const startHour = config.schedule.startHour; // 19 (7pm)
  const endHour = config.schedule.endHour; // 5 (5am)

  // Handle window that crosses midnight
  if (startHour > endHour) {
    // e.g., 19-5 means 7pm to 5am (crosses midnight)
    return currentHour >= startHour || currentHour <= endHour;
  } else {
    // Normal window (doesn't cross midnight)
    return currentHour >= startHour && currentHour <= endHour;
  }
}

/**
 * Get formatted current time in EST
 * @returns Formatted time string
 */
export function getCurrentTimeEST(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: config.schedule.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format date to YYYY-MM-DD
 * @param date Date object
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date string to Date object
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Date object or null if invalid
 */
export function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate minutes until next checking window opens
 * @returns Minutes until window opens, or 0 if already in window
 */
export function minutesUntilNextWindow(): number {
  if (isWithinCheckingWindow()) {
    return 0;
  }

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

  return hoursUntil * 60;
}

/**
 * Get random delay in milliseconds (for avoiding detection)
 * Uses config settings for min/max delay in seconds
 * Matches V2 extension behavior: randomized delays between checks
 * @returns Random delay in milliseconds
 */
export function getRandomDelay(): number {
  const minSeconds = config.schedule.minDelaySec;
  const maxSeconds = config.schedule.maxDelaySec;
  const minMs = minSeconds * 1000;
  const maxMs = maxSeconds * 1000;
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}

/**
 * Get random delay with custom min/max (for specific use cases)
 * @param minSeconds Minimum delay in seconds
 * @param maxSeconds Maximum delay in seconds
 * @returns Random delay in milliseconds
 */
export function getRandomDelayCustom(minSeconds: number, maxSeconds: number): number {
  const minMs = minSeconds * 1000;
  const maxMs = maxSeconds * 1000;
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}
