// Test setup and global configuration
process.env.AWS_REGION = "us-west-2";
process.env.SESSIONS_TABLE = "sms-otp-sessions-test";
process.env.RECORDS_TABLE = "sms-otp-records-test";
process.env.RATE_LIMITS_TABLE = "sms-otp-rate-limits-test";
process.env.AUDIT_LOGS_TABLE = "sms-otp-audit-logs-test";
process.env.SMS_QUEUE_URL =
  "https://sqs.us-west-2.amazonaws.com/123456789012/test-queue";
process.env.TWILIO_ACCOUNT_SID = "AC6510cade2d7d758b5f6a2d7902bd89e3";
process.env.TWILIO_AUTH_TOKEN = "a9916d8ef46d887d347b72cdec88d29a1";
process.env.TWILIO_PHONE_NUMBER = "+15855801246";

// Set test timeout
jest.setTimeout(10000);
