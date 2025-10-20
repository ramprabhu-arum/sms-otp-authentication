// src/utils/logger.ts

/**
 * Simple structured logger for Lambda functions
 * In production, consider using AWS Lambda Powertools
 */
export class Logger {
  private context: Record<string, any> = {};

  constructor(context?: Record<string, any>) {
    this.context = context || {};
  }

  private log(level: string, message: string, meta?: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };
    console.log(JSON.stringify(logEntry));
  }

  info(message: string, meta?: Record<string, any>) {
    this.log("INFO", message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log("WARN", message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>) {
    this.log("ERROR", message, {
      ...meta,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined,
    });
  }

  debug(message: string, meta?: Record<string, any>) {
    if (process.env.DEBUG === "true") {
      this.log("DEBUG", message, meta);
    }
  }
}
