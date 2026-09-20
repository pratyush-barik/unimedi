"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-200">
            +
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              Uni<span className="text-indigo-600">Medi</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
              Unified Healthcare
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/patient/support"
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-xl hover:bg-white/80 transition"
          >
            Help & Support
          </Link>
          <Link
            href="/doctor/login"
            className="text-xs font-bold text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition"
          >
            Doctor Login
          </Link>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="max-w-5xl w-full mx-auto px-6 py-10 flex flex-col items-center text-center my-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-bold mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          Instant QR Walk-in & Slot Booking Platform
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl leading-[1.15]">
          Smart Healthcare &amp; Digital Prescriptions,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
            Simplified.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl font-normal leading-relaxed">
          Connect seamlessly with verified doctors, scan clinic QR codes for walk-in consultation, book online slots, and securely manage your medical history.
        </p>

        {/* Action Portals */}
        <div className="grid sm:grid-cols-2 gap-6 w-full max-w-3xl mt-10">
          {/* Patient Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-200 text-left flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold mb-6 group-hover:scale-105 transition">
                👤
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Patient Portal
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Book appointments, scan clinic QR codes, view verified digital prescriptions, and manage personal health records.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => router.push("/patient/signin")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-xs transition text-center"
              >
                Patient Sign In
              </button>
              <button
                onClick={() => router.push("/patient/signup")}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl border border-slate-200 transition text-center text-sm"
              >
                Create New Patient Account
              </button>
            </div>
          </div>

          {/* Doctor Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-200 text-left flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold mb-6 group-hover:scale-105 transition">
                🩺
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Doctor Console
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Manage appointment queues, generate clinic walk-in QR codes, issue structured prescriptions, and review patient history.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => router.push("/doctor/login")}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-xl shadow-xs transition text-center"
              >
                Doctor Sign In
              </button>
              <Link
                href="/doctor/qr"
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl border border-slate-200 transition text-center text-sm flex items-center justify-center gap-1.5"
              >
                <span>📷</span> Clinic Walk-in QR Code
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mt-12 text-left">
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xl mb-1 block">🔐</span>
            <h4 className="text-xs font-bold text-slate-900">Patient Consent</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Records accessible only with explicit patient grant</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xl mb-1 block">📱</span>
            <h4 className="text-xs font-bold text-slate-900">QR Pairing</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Instant queue check-in via mobile camera</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xl mb-1 block">📄</span>
            <h4 className="text-xs font-bold text-slate-900">Digital Rx &amp; PDF</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Printable standardized pharmacy prescription slips</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xl mb-1 block">⚡</span>
            <h4 className="text-xs font-bold text-slate-900">Email OTP Auth</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Passwordless secure 6-digit one-time codes</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-6 border-t border-slate-200/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} UniMedi Health Systems. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/patient/support" className="hover:text-indigo-600 transition">
            Support Desk
          </Link>
          <span className="text-slate-300">•</span>
          <span className="text-slate-400">College Health Portal</span>
        </div>
      </footer>
    </div>
  );
}