"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DoctorLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Email required");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/send-email-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          type: "login",
          role: "doctor",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        setMessage("OTP sent to your email");
      } else {
        setMessage(data.message);
      }
    } catch {
      setMessage("Something went wrong");
    }

    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!otp.trim()) {
      setMessage("Enter OTP");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          otp,
          type: "login",
          role: "doctor",
        }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem(
          "session",
          JSON.stringify({
            role: "doctor",
            email: cleanEmail,
            phone: data.user.phone || "",
            name: data.user.full_name || "Doctor",
            speciality: data.user.speciality || "General",
          })
        );

        router.replace("/doctor/dashboard");
      } else {
        setMessage(data.message);
      }
    } catch {
      setMessage("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Doctor Login
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Secure access to doctor portal
        </p>

        {!otpSent ? (
          <div className="space-y-4">

            <input
              type="email"
              placeholder="Enter Doctor Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
            />

            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-gray-800 hover:bg-black text-white py-3 rounded-lg"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>

          </div>
        ) : (
          <div className="space-y-4">

            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center tracking-widest"
            />

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

          </div>
        )}

        {message && (
          <p className="text-center text-sm text-gray-600 mt-6">
            {message}
          </p>
        )}

      </div>
    </div>
  );
}