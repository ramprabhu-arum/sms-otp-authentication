// src/services/session.service.ts
import { OTP_CONFIG, Session, SessionStatus } from "../types";
import { generateUUID } from "../utils/crypto";
import { Logger } from "../utils/logger";
import {
  createSession,
  getSession,
  updateSessionStatus,
} from "./dynamodb.service";

const logger = new Logger({ service: "SessionService" });

/**
 * Create a new authentication session
 */
export async function createAuthSession(
  phoneNumber: string,
  appId: string,
  clientSessionId?: string
): Promise<Session> {
  logger.info("Creating auth session", { phoneNumber, appId });

  const sessionId = generateUUID();
  const now = Date.now();
  const expiryAt = now + OTP_CONFIG.SESSION_EXPIRY_SECONDS * 1000;

  const session: Session = {
    sessionId,
    phoneNumber,
    appId,
    clientSessionId: clientSessionId || undefined,
    status: SessionStatus.ACTIVE,
    createdAt: now,
    expiryAt,
    attempts: 0,
    lastActivityAt: now,
  };

  await createSession(session);

  logger.info("Auth session created", { sessionId });

  return session;
}

/**
 * Validate session exists and is not expired/locked
 */
export async function validateSession(sessionId: string): Promise<{
  valid: boolean;
  session?: Session;
  reason?: string;
}> {
  logger.debug("Validating session", { sessionId });

  const session = await getSession(sessionId);

  if (!session) {
    logger.warn("Session not found", { sessionId });
    return { valid: false, reason: "SESSION_NOT_FOUND" };
  }

  // Check if expired
  if (Date.now() > session.expiryAt) {
    logger.warn("Session expired", { sessionId });
    await updateSessionStatus(sessionId, SessionStatus.EXPIRED);
    return { valid: false, reason: "SESSION_EXPIRED" };
  }

  // Check if locked
  if (session.status === SessionStatus.LOCKED) {
    logger.warn("Session locked", {
      sessionId,
      lockReason: session.lockReason,
    });
    return { valid: false, reason: "SESSION_LOCKED", session };
  }

  // Check if already verified
  if (session.status === SessionStatus.VERIFIED) {
    logger.warn("Session already verified", { sessionId });
    return { valid: false, reason: "SESSION_ALREADY_VERIFIED" };
  }

  return { valid: true, session };
}

/**
 * Validate phone number binding (CRITICAL SECURITY CHECK)
 */
export function validatePhoneBinding(
  session: Session,
  providedPhoneNumber: string
): boolean {
  return session.phoneNumber === providedPhoneNumber;
}

/**
 * Lock session due to fraud detection
 */
export async function lockSession(
  sessionId: string,
  reason: string
): Promise<void> {
  logger.warn("Locking session", { sessionId, reason });

  await updateSessionStatus(sessionId, SessionStatus.LOCKED, {
    lockedAt: Date.now(),
    lockReason: reason,
  });
}

/**
 * Check if max attempts exceeded
 */
export function isMaxAttemptsExceeded(attempts: number): boolean {
  return attempts >= OTP_CONFIG.OTP_MAX_ATTEMPTS;
}
