"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { fetchCurrentSession } from "@/lib/authClient";

export default function DoctorQrPage() {
  const router = useRouter();

  const [doctorId, setDoctorId] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorSpeciality, setDoctorSpeciality] = useState("");
  const [hospital, setHospital] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentSession().then(({ authenticated, user }) => {
      if (!authenticated || !user || user.role !== "doctor") {
        router.replace("/doctor/login");
        return;
      }

      setDoctorId(user.id);
      setDoctorEmail(user.email);
      setDoctorName(user.full_name || "Doctor");
      setDoctorSpeciality(user.speciality || "General Physician");
      setHospital(user.hospital_affiliation || "UniMedi Healthcare Clinic");
      setLoading(false);
    });
  }, [router]);

  if (loading || !doctorEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Generating Clinic QR Code...
        </div>
      </div>
    );
  }

  // Value encoded in QR can be doctor ID (with fallback to email)
  const qrPayload = JSON.stringify({
    doctorId,
    email: doctorEmail,
    name: doctorName,
    speciality: doctorSpeciality,
    hospital,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200/80 p-8 text-center">
        {/* Header */}
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            📷
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Clinic Walk-in QR Code
          </h1>
          <p className="text-sm font-bold text-indigo-600 mt-1">
            Dr. {doctorName}
          </p>
          <p className="text-xs text-slate-400">
            {doctorSpeciality} • {hospital}
          </p>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-6 rounded-3xl inline-block border-2 border-slate-100 shadow-md">
          <QRCode value={qrPayload} size={220} level="M" />
        </div>

        {/* Directions */}
        <p className="text-xs text-slate-500 mt-6 leading-relaxed">
          Ask the patient to open <strong>UniMedi &rarr; Scan Doctor QR</strong> on their phone to request an instant consultation queue slot.
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition"
          >
            Print QR Sheet
          </button>
          <Link
            href="/doctor/dashboard"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center shadow-xs"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}