import { supabaseAdmin } from "@/lib/supabase";

type OTPRecord = {
  otp: string;
  expiry: number;
  attempts: number;
  lastSent: number;
};

const globalForOTP = globalThis as unknown as {
  otpStore?: Map<string, OTPRecord>;
};

// Shared in-memory fallback store across hot reloads / offline fallback
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
 * Checks database table auth_otps first, falls back to memory store.
 * Returns { allowed: boolean, waitSeconds?: number }
 */
export async function checkOTPRateLimit(email: string): Promise<{
  allowed: boolean;
  waitSeconds?: number;
}> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabaseAdmin
      .from("auth_otps")
      .select("last_sent_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!error && data?.last_sent_at) {
      const elapsed = Date.now() - new Date(data.last_sent_at).getTime();
      if (elapsed < MIN_SEND_INTERVAL_MS) {
        const waitSeconds = Math.ceil((MIN_SEND_INTERVAL_MS - elapsed) / 1000);
        return { allowed: false, waitSeconds };
      }
    }
  } catch (err) {
    console.warn("[otpStore] Failed to query auth_otps for rate limit, checking in-memory fallback:", err);
    const existing = otpStore.get(normalizedEmail);
    if (existing) {
      const elapsed = Date.now() - existing.lastSent;
      if (elapsed < MIN_SEND_INTERVAL_MS) {
        const waitSeconds = Math.ceil((MIN_SEND_INTERVAL_MS - elapsed) / 1000);
        return { allowed: false, waitSeconds };
      }
    }
  }

  return { allowed: true };
}

/**
 * Generates and stores a 6-digit OTP for the email.
 * Persists to Postgres table auth_otps and syncs to memory store.
 */
export async function generateOTP(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_VALIDITY_MS);

  // Sync memory cache
  otpStore.set(normalizedEmail, {
    otp,
    expiry: expiresAt.getTime(),
    attempts: 0,
    lastSent: now.getTime(),
  });

  try {
    const { error } = await supabaseAdmin.from("auth_otps").upsert(
      {
        email: normalizedEmail,
        otp_code: otp,
        attempts: 0,
        last_sent_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      },
      { onConflict: "email" }
    );

    if (error) {
      console.error("[otpStore] Error persisting OTP to database:", error);
    }
  } catch (err) {
    console.error("[otpStore] Exception during database OTP upsert:", err);
  }

  return otp;
}

/**
 * Verifies the OTP for an email.
 * Checks database table auth_otps first, falls back to memory store.
 * Returns { success: boolean, reason?: string }
 */
export async function verifyOTP(
  email: string,
  enteredOtp: string
): Promise<{ success: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanEnteredOtp = enteredOtp.trim();

  let dbRecord: any = null;

  try {
    const res = await supabaseAdmin
      .from("auth_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    dbRecord = res.data;
  } catch (err) {
    console.warn("[otpStore] Database lookup error during verifyOTP:", err);
  }

  // 1. Process via Database Record if available
  if (dbRecord) {
    const expiresAt = new Date(dbRecord.expires_at).getTime();

    if (Date.now() > expiresAt) {
      await supabaseAdmin.from("auth_otps").delete().eq("email", normalizedEmail);
      otpStore.delete(normalizedEmail);
      return { success: false, reason: "OTP has expired. Please request a new one." };
    }

    if (dbRecord.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("auth_otps").delete().eq("email", normalizedEmail);
      otpStore.delete(normalizedEmail);
      return {
        success: false,
        reason: "Too many incorrect attempts. Please request a new OTP.",
      };
    }

    const updatedAttempts = (dbRecord.attempts || 0) + 1;
    const isValid = dbRecord.otp_code === cleanEnteredOtp;

    if (isValid) {
      await supabaseAdmin.from("auth_otps").delete().eq("email", normalizedEmail);
      otpStore.delete(normalizedEmail);
      return { success: true };
    } else {
      await supabaseAdmin
        .from("auth_otps")
        .update({ attempts: updatedAttempts })
        .eq("email", normalizedEmail);

      return {
        success: false,
        reason: `Invalid OTP. ${MAX_ATTEMPTS - updatedAttempts} attempts remaining.`,
      };
    }
  }

  // 2. Fallback to In-Memory Store (if DB failed or record cached locally)
  const memRecord = otpStore.get(normalizedEmail);
  if (!memRecord) {
    return { success: false, reason: "No OTP requested or OTP has expired." };
  }

  if (Date.now() > memRecord.expiry) {
    otpStore.delete(normalizedEmail);
    return { success: false, reason: "OTP has expired. Please request a new one." };
  }

  if (memRecord.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      reason: "Too many incorrect attempts. Please request a new OTP.",
    };
  }

  memRecord.attempts += 1;
  const isValid = memRecord.otp === cleanEnteredOtp;

  if (isValid) {
    otpStore.delete(normalizedEmail);
    return { success: true };
  }

  return {
    success: false,
    reason: `Invalid OTP. ${MAX_ATTEMPTS - memRecord.attempts} attempts remaining.`,
  };
}