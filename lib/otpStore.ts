type OTPRecord = {
  otp: string;
  expiry: number;
  attempts: number;
  lastSent: number;
};

const globalForOTP = globalThis as unknown as {
  otpStore?: Map<string, OTPRecord>;
};

// Shared global store across hot reloads / serverless invocations within runtime
export const otpStore =
  globalForOTP.otpStore || new Map<string, OTPRecord>();

if (!globalForOTP.otpStore) {
  globalForOTP.otpStore = otpStore;
}

const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
const MIN_SEND_INTERVAL_MS = 30 * 1000; // 30 seconds rate limit between sends
const MAX_ATTEMPTS = 5; // Max 5 verification attempts before invalidating

/**
 * Checks if an email is rate-limited from requesting another OTP.
 * Returns { allowed: boolean, waitSeconds?: number }
 */
export function checkOTPRateLimit(email: string): {
  allowed: boolean;
  waitSeconds?: number;
} {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = otpStore.get(normalizedEmail);
  if (existing) {
    const elapsed = Date.now() - existing.lastSent;
    if (elapsed < MIN_SEND_INTERVAL_MS) {
      const waitSeconds = Math.ceil((MIN_SEND_INTERVAL_MS - elapsed) / 1000);
      return { allowed: false, waitSeconds };
    }
  }
  return { allowed: true };
}

/**
 * Generates and stores a 6-digit OTP for the email.
 */
export function generateOTP(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(normalizedEmail, {
    otp,
    expiry: Date.now() + OTP_VALIDITY_MS,
    attempts: 0,
    lastSent: Date.now(),
  });

  return otp;
}

/**
 * Verifies the OTP for an email.
 * Returns { success: boolean, reason?: string }
 */
export function verifyOTP(
  email: string,
  enteredOtp: string
): { success: boolean; reason?: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return { success: false, reason: "No OTP requested or OTP has expired." };
  }

  if (Date.now() > record.expiry) {
    otpStore.delete(normalizedEmail);
    return { success: false, reason: "OTP has expired. Please request a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      reason: "Too many incorrect attempts. Please request a new OTP.",
    };
  }

  record.attempts += 1;

  const valid = record.otp === enteredOtp.trim();

  if (valid) {
    otpStore.delete(normalizedEmail);
    return { success: true };
  }

  return {
    success: false,
    reason: `Invalid OTP. ${MAX_ATTEMPTS - record.attempts} attempts remaining.`,
  };
}