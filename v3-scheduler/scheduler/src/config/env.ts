import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface AppConfig {
  // Database
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };

  // Visa Portal
  visa: {
    email: string;
    password: string;
    countryCode: string;
    userId?: string;
  };

  // Facilities
  facilities: number[];
  facilityMap: { [key: number]: string };

  // Scheduling
  schedule: {
    timezone: string;
    startHour: number;
    endHour: number;
    minDelaySec: number;         // V2-style: Minimum delay in seconds
    maxDelaySec: number;         // V2-style: Maximum delay in seconds
    sessionRefreshMin: number;   // Page refresh interval
  };

  // Booking
  booking: {
    maxRetries: number;
    startDateFilter?: Date;
    endDateFilter?: Date;
  };

  // Logging
  logging: {
    level: string;
  };

  // Security
  security: {
    encryptionKey: string;
  };
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseDate(dateStr?: string): Date | undefined {
  if (!dateStr || dateStr.trim() === '') return undefined;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return date;
}

export const config: AppConfig = {
  database: {
    host: getEnvVar('DB_HOST', 'postgres'),
    port: parseInt(getEnvVar('DB_PORT', '5432'), 10),
    name: getEnvVar('DB_NAME', 'visa_scheduler'),
    user: getEnvVar('DB_USER', 'visabot'),
    password: getEnvVar('DB_PASSWORD'),
  },

  visa: {
    email: getEnvVar('VISA_EMAIL'),
    password: getEnvVar('VISA_PASSWORD'),
    countryCode: getEnvVar('COUNTRY_CODE', 'ca'),
    userId: process.env.USER_ID || undefined,
  },

  facilities: getEnvVar('FACILITIES', '94,89,95')
    .split(',')
    .map((f) => parseInt(f.trim(), 10))
    .filter((f) => !isNaN(f)),

  facilityMap: {
    94: 'Toronto',
    89: 'Calgary',
    95: 'Vancouver',
  },

  schedule: {
    timezone: getEnvVar('TZ', 'America/New_York'),
    startHour: parseInt(getEnvVar('CHECK_START_HOUR', '19'), 10), // 7pm
    endHour: parseInt(getEnvVar('CHECK_END_HOUR', '5'), 10), // 5am
    minDelaySec: parseInt(getEnvVar('MIN_DELAY_SEC', '5'), 10), // V2-style: 5 sec min
    maxDelaySec: parseInt(getEnvVar('MAX_DELAY_SEC', '30'), 10), // V2-style: 30 sec max
    sessionRefreshMin: parseInt(getEnvVar('SESSION_REFRESH_MIN', '10'), 10), // Page refresh every 10 min
  },

  booking: {
    maxRetries: parseInt(getEnvVar('MAX_BOOKING_RETRIES', '3'), 10),
    startDateFilter: parseDate(process.env.START_DATE_FILTER),
    endDateFilter: parseDate(process.env.END_DATE_FILTER),
  },

  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },

  security: {
    encryptionKey: getEnvVar('ENCRYPTION_KEY'),
  },
};

// Validate configuration
export function validateConfig(): void {
  const errors: string[] = [];

  // Validate email
  if (!config.visa.email.includes('@')) {
    errors.push('Invalid VISA_EMAIL format');
  }

  // Validate encryption key length (must be 32 chars for AES-256)
  if (config.security.encryptionKey.length !== 32) {
    errors.push('ENCRYPTION_KEY must be exactly 32 characters for AES-256');
  }

  // Validate facilities
  if (config.facilities.length === 0) {
    errors.push('At least one facility must be specified in FACILITIES');
  }

  // Validate schedule hours
  if (config.schedule.startHour < 0 || config.schedule.startHour > 23) {
    errors.push('CHECK_START_HOUR must be between 0 and 23');
  }
  if (config.schedule.endHour < 0 || config.schedule.endHour > 23) {
    errors.push('CHECK_END_HOUR must be between 0 and 23');
  }

  // Validate delay settings
  if (config.schedule.minDelaySec < 1) {
    errors.push('MIN_DELAY_SEC must be at least 1 second');
  }
  if (config.schedule.maxDelaySec < config.schedule.minDelaySec) {
    errors.push('MAX_DELAY_SEC must be greater than or equal to MIN_DELAY_SEC');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
