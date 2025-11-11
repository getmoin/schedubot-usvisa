import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import { config } from '../config/env';

const logDir = process.env.LOG_DIR || '/app/logs';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create the logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Daily rotate file for all logs
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),

    // Daily rotate file for errors only
    new DailyRotateFile({
      level: 'error',
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    }),
  ],
  exitOnError: false,
});

// Create specialized loggers for different modules
export const createModuleLogger = (moduleName: string) => {
  return {
    debug: (message: string, ...args: any[]) => logger.debug(`[${moduleName}] ${message}`, ...args),
    info: (message: string, ...args: any[]) => logger.info(`[${moduleName}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => logger.warn(`[${moduleName}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => logger.error(`[${moduleName}] ${message}`, ...args),
  };
};

// Utility function to log with emoji (like V2)
export const log = {
  success: (message: string) => logger.info(`✅ ${message}`),
  error: (message: string) => logger.error(`❌ ${message}`),
  warn: (message: string) => logger.warn(`⚠️  ${message}`),
  info: (message: string) => logger.info(`ℹ️  ${message}`),
  check: (message: string) => logger.info(`🔍 ${message}`),
  booking: (message: string) => logger.info(`🎯 ${message}`),
  found: (message: string) => logger.info(`🎉 ${message}`),
  retry: (message: string) => logger.warn(`🔄 ${message}`),
  session: (message: string) => logger.info(`🔐 ${message}`),
};

export default logger;
