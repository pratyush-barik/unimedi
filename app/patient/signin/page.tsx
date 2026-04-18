"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PatientSigninPage() {
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
          role: "patient",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message);
        setLoading(false);
        return;
      }

      localStorage.setItem(
        "session",
        JSON.stringify({
          role: "patient",
          email: cleanEmail,
          phone: data.user.phone || "",
          name: data.user.full_name || "",
        })
      );

      // check profile
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!userRow) {
        router.push("/patient/dashboard");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userRow.id)
        .maybeSingle();

      if (!profile) {
        router.push("/patient/profile-setup");
      } else {
        router.push("/patient/dashboard");
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
          Patient Sign In
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Access your patient portal
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