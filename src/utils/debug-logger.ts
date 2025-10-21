// src/utils/debug-logger.ts

/**
 * Enhanced debug logger for development and troubleshooting
 * Can be enabled/disabled via DEBUG_LOGGING environment variable
 */
export class DebugLogger {
  private functionName: string;
  private requestId: string;
  private enabled: boolean;

  constructor(functionName: string, requestId?: string) {
    this.functionName = functionName;
    this.requestId =
      requestId ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.enabled = process.env.DEBUG_LOGGING !== "false"; // Enabled by default
  }

  /**
   * Log incoming request
   */
  logRequest(message: string, data?: any): void {
    if (!this.enabled) return;

    console.log(
      "\n================================================================================"
    );
    console.log(`📥 [${this.functionName}] INCOMING REQUEST`);
    console.log(
      "================================================================================"
    );
    this.log("REQUEST", message, data);
  }

  /**
   * Log outgoing response
   */
  logResponse(message: string, data?: any): void {
    if (!this.enabled) return;

    console.log(
      "\n================================================================================"
    );
    console.log(`📤 [${this.functionName}] OUTGOING RESPONSE`);
    console.log(
      "================================================================================"
    );
    this.log("RESPONSE", message, data);
  }

  /**
   * Log a flow step
   */
  logFlowStep(step: number, message: string, data?: any): void {
    if (!this.enabled) return;

    console.log(
      "\n▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶"
    );
    console.log(`🔹 STEP ${step}: ${message}`);
    console.log(
      "▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶"
    );
    this.log("FLOW_STEP", `Step ${step}: ${message}`, data);
  }

  /**
   * Log service call (to DynamoDB, SQS, Twilio, etc.)
   */
  logServiceCall(serviceName: string, operation: string, data?: any): void {
    if (!this.enabled) return;

    console.log("\n→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→");
    console.log(
      `📞 [${this.functionName}] CALLING: ${serviceName}.${operation}`
    );
    console.log("→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→");
    this.log("SERVICE_CALL", `Calling ${serviceName}.${operation}`, data);
  }

  /**
   * Log service response
   */
  logServiceResponse(serviceName: string, operation: string, data?: any): void {
    if (!this.enabled) return;

    console.log("\n←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←");
    console.log(`✅ SERVICE RESPONSE: ${serviceName}.${operation}`);
    console.log("←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←");
    this.log(
      "SERVICE_RESPONSE",
      `Response from ${serviceName}.${operation}`,
      data
    );
  }

  /**
   * Log SQS message send
   */
  logSQSSend(queueName: string, messageBody: any): void {
    if (!this.enabled) return;

    console.log("\n→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→");
    console.log(`📮 [${this.functionName}] SENDING TO SQS: ${queueName}`);
    console.log("→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→");
    this.log("SQS_SEND", `Sending message to ${queueName}`, {
      queueName,
      messageBody:
        typeof messageBody === "string"
          ? messageBody
          : JSON.stringify(messageBody),
    });
  }

  /**
   * Log SQS message receive
   */
  logSQSReceive(queueName: string, messageBody: string): void {
    if (!this.enabled) return;

    console.log("\n←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←");
    console.log(`📬 [${this.functionName}] RECEIVED FROM SQS: ${queueName}`);
    console.log("←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←");
    this.log("SQS_RECEIVE", `Received message from ${queueName}`, {
      queueName,
      messageBody,
    });
  }

  /**
   * Log general data
   */
  logData(message: string, data: any): void {
    if (!this.enabled) return;

    this.log("DATA", message, data);
  }

  /**
   * Log error
   */
  logError(message: string, error: Error, data?: any): void {
    if (!this.enabled) return;

    console.error(
      "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    );
    console.error(`❌ [${this.functionName}] ERROR`);
    console.error(
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    );
    this.log("ERROR", message, {
      error: {
        message: error.message,
        stack: error.stack,
      },
      ...data,
    });
    console.error(
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    );
  }

  /**
   * Core logging method
   */
  private log(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      function: this.functionName,
      requestId: this.requestId,
      message,
      ...(data && { data }),
    };

    console.log(JSON.stringify(logEntry, null, 2));
  }
}
