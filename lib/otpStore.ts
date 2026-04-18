type OTPRecord = {
  otp: string;
  expiry: number;
};

const globalForOTP = globalThis as unknown as {
  otpStore?: Map<string, OTPRecord>;
};

// ✅ Create shared global store
export const otpStore =
  globalForOTP.otpStore ||
  new Map<string, OTPRecord>();

if (!globalForOTP.otpStore) {
  globalForOTP.otpStore = otpStore;
}

// 🔹 Generate OTP
export function generateOTP(email: string) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(email, {
    otp,
    expiry: Date.now() + 5 * 60 * 1000,
  });

  console.log("OTP stored for:", email, otp);

  return otp;
}

// 🔹 Verify OTP
export function verifyOTP(email: string, enteredOtp: string) {
  const record = otpStore.get(email);

  console.log("Stored OTP:", record?.otp);
  console.log("Entered OTP:", enteredOtp);

  if (!record) return false;

  if (Date.now() > record.expiry) {
    otpStore.delete(email);
    return false;
  }

  const valid = record.otp === enteredOtp;

  if (valid) otpStore.delete(email);

  return valid;
}