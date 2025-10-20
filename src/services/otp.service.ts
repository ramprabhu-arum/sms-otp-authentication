// src/services/otp.service.ts
import { OTP_CONFIG, OTPVerificationResult } from "../types";
import {
  generateOTP,
  generateUUID,
  hashOTP,
  timingSafeEqual,
} from "../utils/crypto";
import { Logger } from "../utils/logger";
import { getOTPBySession, markOTPVerified, storeOTP } from "./dynamodb.service";
import { OTPRecord } from "../types";

const logger = new Logger({ service: "OTPService" });

/**
 * Generate and store OTP for a session
 */
export async function generateAndStoreOTP(
  sessionId: string
): Promise<{ otp: string; otpId: string }> {
  const otp = generateOTP();
  const hashedOTP = hashOTP(otp, sessionId);
  const otpId = generateUUID();

  const otpRecord: OTPRecord = {
    otpId,
    sessionId,
    hashedOTP,
    createdAt: Date.now(),
    expiresAt: Date.now() + OTP_CONFIG.OTP_EXPIRY_SECONDS * 1000,
    verified: false,
  };

  await storeOTP(otpRecord);

  logger.info("OTP generated and stored", { sessionId, otpId });

  return { otp, otpId };
}

/**
 * Verify OTP using timing-safe comparison
 */
export async function verifyOTP(
  sessionId: string,
  providedOTP: string
): Promise<OTPVerificationResult> {
  logger.info("Verifying OTP", { sessionId });

  // Get stored OTP record
  const otpRecord = await getOTPBySession(sessionId);

  if (!otpRecord) {
    logger.warn("No OTP found for session", { sessionId });
    return { valid: false, reason: "NO_OTP_FOUND" };
  }

  // Check if OTP has expired
  if (Date.now() > otpRecord.expiresAt) {
    logger.warn("OTP expired", { sessionId, otpId: otpRecord.otpId });
    return { valid: false, reason: "OTP_EXPIRED" };
  }

  // Check if already verified
  if (otpRecord.verified) {
    logger.warn("OTP already used", { sessionId, otpId: otpRecord.otpId });
    return { valid: false, reason: "OTP_ALREADY_USED" };
  }

  // Hash the provided OTP
  const providedHash = hashOTP(providedOTP, sessionId);

  // Timing-safe comparison
  const isValid = timingSafeEqual(providedHash, otpRecord.hashedOTP);

  if (isValid) {
    // Mark OTP as verified
    await markOTPVerified(otpRecord.otpId);
    logger.info("OTP verified successfully", {
      sessionId,
      otpId: otpRecord.otpId,
    });
    return { valid: true, otpId: otpRecord.otpId };
  } else {
    logger.warn("Invalid OTP provided", { sessionId });
    return { valid: false, reason: "INVALID_OTP" };
  }
}
