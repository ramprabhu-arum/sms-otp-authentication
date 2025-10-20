// src/services/ratelimit.service.ts
import { OTP_CONFIG, RateLimitResult } from "../types";
import { Logger } from "../utils/logger";
import { getRateLimit, upsertRateLimit } from "./dynamodb.service";

const logger = new Logger({ service: "RateLimitService" });

/**
 * Check and update rate limit for a given identifier
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number
): Promise<RateLimitResult> {
  logger.debug("Checking rate limit", { identifier });

  const now = Date.now();
  const windowMs = OTP_CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;

  // Get existing rate limit record
  const existing = await getRateLimit(identifier);

  if (!existing) {
    // First request - create new record
    await upsertRateLimit({
      identifier,
      count: 1,
      windowStart: now,
    });

    logger.debug("Rate limit initialized", {
      identifier,
      remaining: maxRequests - 1,
    });

    return {
      limited: false,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  // Check if window has expired
  if (now - existing.windowStart > windowMs) {
    // Reset window
    await upsertRateLimit({
      identifier,
      count: 1,
      windowStart: now,
    });

    logger.debug("Rate limit window reset", {
      identifier,
      remaining: maxRequests - 1,
    });

    return {
      limited: false,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  // Within current window
  const newCount = existing.count + 1;

  if (newCount > maxRequests) {
    // Rate limit exceeded
    logger.warn("Rate limit exceeded", {
      identifier,
      count: newCount,
      maxRequests,
    });

    return {
      limited: true,
      remaining: 0,
      resetAt: existing.windowStart + windowMs,
    };
  }

  // Update count
  await upsertRateLimit({
    identifier,
    count: newCount,
    windowStart: existing.windowStart,
  });

  logger.debug("Rate limit updated", {
    identifier,
    remaining: maxRequests - newCount,
  });

  return {
    limited: false,
    remaining: maxRequests - newCount,
    resetAt: existing.windowStart + windowMs,
  };
}

/**
 * Check rate limit for phone number
 */
export async function checkPhoneRateLimit(
  phoneNumber: string
): Promise<RateLimitResult> {
  return checkRateLimit(
    `phone:${phoneNumber}`,
    OTP_CONFIG.RATE_LIMIT_PHONE_MAX
  );
}

/**
 * Check rate limit for IP address
 */
export async function checkIPRateLimit(
  ipAddress: string
): Promise<RateLimitResult> {
  return checkRateLimit(`ip:${ipAddress}`, OTP_CONFIG.RATE_LIMIT_IP_MAX);
}
