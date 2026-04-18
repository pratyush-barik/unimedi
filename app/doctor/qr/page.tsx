"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";

export default function DoctorQrPage() {
  const router = useRouter();

  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorName, setDoctorName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("session");

    if (!stored) {
      router.push("/doctor/login");
      return;
    }

    const session = JSON.parse(stored);

    if (session.role !== "doctor") {
      router.push("/doctor/login");
      return;
    }

    setDoctorEmail(session.email || "");
    setDoctorName(session.name || "Doctor");
  }, [router]);

  if (!doctorEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading QR...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center">

        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Doctor QR Code
        </h1>

        <p className="text-gray-500 mb-6">
          {doctorName}
        </p>

        <div className="bg-white p-4 rounded-xl inline-block shadow">
          <QRCode
            value={doctorEmail}
            size={220}
          />
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Ask patient to scan this QR code to connect.
        </p>

        <button
          onClick={() => router.push("/doctor/dashboard")}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg"
        >
          Back to Dashboard
        </button>

      </div>

    </div>
  );
}