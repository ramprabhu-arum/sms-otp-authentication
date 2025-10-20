// src/utils/crypto.ts
import * as crypto from "crypto";

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
}

/**
 * Hash OTP using HMAC-SHA256 with session ID as salt
 * This prevents rainbow table attacks and binds OTP to session
 */
export function hashOTP(otp: string, sessionId: string): string {
  const hmac = crypto.createHmac("sha256", sessionId);
  hmac.update(otp);
  return hmac.digest("hex");
}

/**
 * Timing-safe comparison to prevent timing attacks
 * Always compares all bytes regardless of match
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    return false;
  }
}

/**
 * Validate phone number format (E.164)
 * E.164 format: +[country code][number]
 * Example: +1234567890
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
