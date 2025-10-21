// src/utils/logger.ts

interface LoggerOptions {
  lambda: string;
}

/**
 * Simple structured logger for Lambda functions
 */
export class Logger {
  private lambda: string;

  constructor(options: LoggerOptions) {
    this.lambda = options.lambda;
  }

  info(message: string, data?: any): void {
    this.log("INFO", message, data);
  }

  error(message: string, error: Error, data?: any): void {
    this.log("ERROR", message, {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...data,
    });
  }

  warn(message: string, data?: any): void {
    this.log("WARN", message, data);
  }

  private log(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      lambda: this.lambda,
      ...data,
    };

    if (level === "ERROR") {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}
