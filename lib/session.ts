import crypto from "crypto";
import { cookies } from "next/headers";
import { SessionPayload } from "./types";

const COOKIE_NAME = "session_token";
const DEFAULT_EXPIRY_DAYS = 7;
const FALLBACK_SECRET = "unimedi_secure_session_secret_f92c8928a30f40dcb76e23971946ec39d5203fa0e620584284d720b080b06b29";

function getSecret(): string {
  return process.env.SESSION_SECRET || FALLBACK_SECRET;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString("utf-8");
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 */
export function signSessionToken(
  payload: Omit<SessionPayload, "exp"> & { exp?: number }
): string {
  const secret = getSecret();
  const exp =
    payload.exp || Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_DAYS * 86400;
  const fullPayload: SessionPayload = { ...payload, exp };

  const payloadString = JSON.stringify(fullPayload);
  const encodedPayload = base64UrlEncode(payloadString);

  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the signature and expiration of a session token.
 * Returns the decoded SessionPayload or null if invalid/expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    const secret = getSecret();

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson) as SessionPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to get current session payload on server side from cookies
 */
export async function getSessionFromServer(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DEFAULT_EXPIRY_DAYS * 86400,
};
