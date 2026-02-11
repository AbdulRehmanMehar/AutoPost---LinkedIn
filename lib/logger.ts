/**
 * Structured Logger for Production
 * 
 * Outputs JSON-structured log lines to prevent interleaving of concurrent
 * async operations. Each log line is a single atomic JSON object.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('publish', 'Publishing post', { postId, platform });
 *   logger.error('publish', 'Failed to publish', { error: err.message });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;      // e.g. 'cron:publish', 'icp-agent', 'conversation-monitor'
  message: string;
  data?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level (configurable via env)
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function formatLog(entry: LogEntry): string {
  // In production, output JSON for structured log ingestion (CloudWatch, Datadog, etc.)
  if (process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json') {
    return JSON.stringify(entry);
  }
  
  // In development, output human-readable format
  const levelBadge = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
  }[entry.level];
  
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${entry.timestamp} ${levelBadge} [${entry.context}] ${entry.message}${dataStr}`;
}

function log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
  
  const output = formatLog(entry);
  
  // Use appropriate console method — each is an atomic write
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  debug: (context: string, message: string, data?: Record<string, unknown>) =>
    log('debug', context, message, data),
    
  info: (context: string, message: string, data?: Record<string, unknown>) =>
    log('info', context, message, data),
    
  warn: (context: string, message: string, data?: Record<string, unknown>) =>
    log('warn', context, message, data),
    
  error: (context: string, message: string, data?: Record<string, unknown>) =>
    log('error', context, message, data),
    
  /**
   * Create a child logger with a fixed context prefix
   */
  child: (context: string) => ({
    debug: (message: string, data?: Record<string, unknown>) => log('debug', context, message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', context, message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', context, message, data),
    error: (message: string, data?: Record<string, unknown>) => log('error', context, message, data),
  }),
};
