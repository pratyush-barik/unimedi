"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";

export default function PatientSigninPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" | "info" } | null>(null);

  useEffect(() => {
    // If already authenticated as patient, redirect to dashboard
    fetchCurrentSession().then(({ authenticated, user }) => {
      if (authenticated && user?.role === "patient") {
        router.replace("/patient/dashboard");
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage({ text: "Please enter your email address.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          type: "login",
          role: "patient",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
        setMessage({
          text: `A 6-digit OTP has been sent to ${cleanEmail}. Please check your inbox.`,
          type: "success",
        });
      } else {
        setMessage({ text: data.message || "Failed to send OTP.", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setMessage({ text: "Please enter the 6-digit verification code.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp,
          type: "login",
          role: "patient",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage({ text: data.message || "Invalid OTP code.", type: "error" });
        setLoading(false);
        return;
      }

      // Check if user has complete profile in users table
      const { data: userRow } = await supabase
        .from("users")
        .select("blood_group, gender, date_of_birth")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!userRow || !userRow.blood_group) {
        router.replace("/patient/profile-setup");
      } else {
        router.replace("/patient/dashboard");
      }
    } catch {
      setMessage({ text: "Verification failed. Please try again.", type: "error" });
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Checking existing session...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            👤
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Patient Sign In
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access appointments, history &amp; digital prescriptions
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold mb-6 border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : message.type === "info"
                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Registered Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-xs transition"
            >
              {loading ? "Sending One-Time Code..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Change Email
                </button>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[6px] text-indigo-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-xs transition"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleSendOtp}
              className="w-full text-xs text-slate-500 hover:text-slate-800 font-semibold py-2 transition"
            >
              Didn't receive code? Resend OTP
            </button>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3 text-xs text-slate-500">
          <p>
            New to UniMedi?{" "}
            <Link
              href="/patient/signup"
              className="text-indigo-600 font-bold hover:underline"
            >
              Create an account
            </Link>
          </p>
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-600 transition"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}