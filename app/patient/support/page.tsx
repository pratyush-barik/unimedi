"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession } from "@/lib/authClient";

export default function PatientSupportPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("patient");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchCurrentSession().then(({ authenticated, user }) => {
      if (authenticated && user) {
        setName(user.full_name || "");
        setEmail(user.email || "");
        setRole(user.role || "patient");
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !messageText) {
      setStatusMessage({ text: "Please fill out all required fields.", type: "error" });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/user-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          subject,
          message: messageText,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          text: "Thank you! Your query has been submitted. Our support team will review and respond to your email.",
          type: "success",
        });
        setSubject("");
        setMessageText("");
      } else {
        setStatusMessage({ text: data.message || "Failed to submit query.", type: "error" });
      }
    } catch {
      setStatusMessage({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8 flex flex-col justify-between">
      <div className="max-w-2xl w-full mx-auto my-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-xs">
              💬
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              UniMedi Help &amp; Support Desk
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Have a question or need technical assistance? Send our team a message.
            </p>
          </div>

          {statusMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold mb-6 border ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Subject *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Appointment rescheduling, Prescription issue, General query"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Your Message *
              </label>
              <textarea
                required
                rows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Describe your issue or feedback in detail..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-xs transition"
            >
              {submitting ? "Submitting..." : "Submit Query to Support Team"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center text-xs text-slate-500">
            <Link href="/" className="hover:text-indigo-600 transition">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
