// src/types/index.ts

/**
 * Configuration constants for SMS OTP system
 */
export const OTP_CONFIG = {
  // Static QR Configuration
  STATIC_QR_APP_ID: process.env.STATIC_QR_APP_ID || "my-app",
  STATIC_QR_SECRET: process.env.STATIC_QR_SECRET || "dGhpc21zc3RhdGljc2VjcmV0",

  // OTP Configuration
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: parseInt(process.env.OTP_EXPIRY_SECONDS || "600"),
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || "3"),

  // Session Configuration
  SESSION_EXPIRY_SECONDS: parseInt(process.env.SESSION_EXPIRY_SECONDS || "600"),

  // Rate Limiting
  RATE_LIMIT_PHONE_MAX: parseInt(process.env.RATE_LIMIT_PHONE_MAX || "5"),
  RATE_LIMIT_IP_MAX: parseInt(process.env.RATE_LIMIT_IP_MAX || "20"),
  RATE_LIMIT_WINDOW_SECONDS: parseInt(
    process.env.RATE_LIMIT_WINDOW_SECONDS || "3600"
  ),
} as const;

/**
 * Session status enum
 */
export enum SessionStatus {
  ACTIVE = "ACTIVE",
  OTP_GENERATED = "OTP_GENERATED",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  LOCKED = "LOCKED",
}

/**
 * Audit event types
 */
export enum AuditEventType {
  QR_VALIDATED = "QR_VALIDATED",
  OTP_REQUESTED = "OTP_REQUESTED",
  OTP_VERIFIED_SUCCESS = "OTP_VERIFIED_SUCCESS",
  OTP_VERIFIED_FAILED = "OTP_VERIFIED_FAILED",
  SESSION_LOCKED = "SESSION_LOCKED",
  FRAUD_DETECTED = "FRAUD_DETECTED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

/**
 * Session record in DynamoDB
 */
export interface Session {
  sessionId: string;
  phoneNumber: string;
  appId: string;
  clientSessionId?: string;
  status: SessionStatus;
  createdAt: number;
  expiryAt: number;
  attempts: number;
  lastActivityAt: number;
  lockedAt?: number;
  lockReason?: string;
}

/**
 * OTP record in DynamoDB
 */
export interface OTPRecord {
  otpId: string;
  sessionId: string;
  hashedOTP: string;
  createdAt: number;
  expiresAt: number;
  verified: boolean;
}

/**
 * Rate limit record in DynamoDB
 */
export interface RateLimit {
  identifier: string;
  count: number;
  windowStart: number;
}

/**
 * Audit log record in DynamoDB
 */
export interface AuditLog {
  logId: string;
  eventType: AuditEventType;
  sessionId?: string;
  phoneNumber?: string;
  appId?: string;
  ipAddress?: string;
  timestamp: number;
  details?: string;
  success: boolean;
}

/**
 * API Gateway Lambda event context
 */
export interface APIContext {
  requestId: string;
  sourceIp: string;
  userAgent?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * OTP verification result
 */
export interface OTPVerificationResult {
  valid: boolean;
  reason?: string;
  otpId?: string;
}
