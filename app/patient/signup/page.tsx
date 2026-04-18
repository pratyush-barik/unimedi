"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !cleanPhone) {
      setMessage("Email and phone required");
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
          phone: cleanPhone,
          type: "signup",
          role: "patient",
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
    const cleanPhone = phone.trim();

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
          phone: cleanPhone,
          otp,
          type: "signup",
          role: "patient",
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("Signup successful. Please sign in.");

        router.push("/patient/signin");
      } else {
        setMessage(data.message);
      }
    } catch {
      setMessage("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-indigo-600 mb-2">
          Patient Signup
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Create patient access
        </p>

        {!otpSent ? (
          <div className="space-y-4">

            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />

            <input
              type="text"
              placeholder="Enter Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />

            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg"
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
              className="w-full border rounded-lg px-4 py-3 text-center"
            />

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

          </div>
        )}

        {message && (
          <p className="text-center text-sm mt-6 text-gray-600">
            {message}
          </p>
        )}

      </div>
    </div>
  );
}