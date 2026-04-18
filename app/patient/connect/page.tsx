"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabase";

export default function PatientConnectPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {}
  };

  const connectDoctor = async (doctorEmail: string) => {
    try {
      setLoading(true);

      const stored = localStorage.getItem("session");

      if (!stored) {
        router.push("/patient/signin");
        return;
      }

      const session = JSON.parse(stored);

      const { data: patient } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      if (!patient) {
        setMessage("Patient account not found");
        return;
      }

      const { data: doctor } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("email", doctorEmail)
        .maybeSingle();

      if (!doctor) {
        setMessage("Doctor not found");
        return;
      }

      // 🔹 delete old active sessions for patient
      await supabase
        .from("doctor_sessions")
        .delete()
        .eq("patient_id", patient.id);

      // 🔹 create fresh session
      await supabase.from("doctor_sessions").insert([
        {
          patient_id: patient.id,
          doctor_id: doctor.id,
          approved: true,
        },
      ]);

      await stopScanner();

      alert(`${doctor.full_name || "Doctor"} connected`);

      router.push("/patient/dashboard");

    } catch {
      setMessage("Connection failed");
    }

    setLoading(false);
  };

  const startScanner = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();

      if (!devices.length) {
        setMessage("No camera found");
        return;
      }

      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;

      await scanner.start(
        devices[0].id,
        {
          fps: 10,
          qrbox: 260,
        },
        async (decodedText) => {
          await connectDoctor(decodedText);
        },
        () => {}
      );

    } catch {
      setMessage("Camera access denied");
    }
  };

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-indigo-600 mb-2">
          Scan Doctor QR
        </h1>

        <p className="text-center text-gray-500 mb-6">
          Camera opened automatically. Scan doctor QR code.
        </p>

        <div
          id="reader"
          className="w-full overflow-hidden rounded-2xl border border-gray-200"
        />

        {loading && (
          <p className="text-center text-indigo-600 mt-5">
            Connecting...
          </p>
        )}

        {message && (
          <p className="text-center text-red-500 mt-5">
            {message}
          </p>
        )}

      </div>

    </div>
  );
}