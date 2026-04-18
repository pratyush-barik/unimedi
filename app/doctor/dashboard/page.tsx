"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DoctorUser = {
  id: string;
  email: string;
  name: string;
  speciality: string;
};

type SessionRow = {
  patientName: string;
};

export default function DoctorDashboard() {
  const router = useRouter();

  const [doctor, setDoctor] = useState<DoctorUser | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);

  useEffect(() => {
    loadDoctor();
  }, []);

  useEffect(() => {
    if (doctor) {
      loadSession();

      const interval = setInterval(() => {
        loadSession();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [doctor]);

  const loadDoctor = async () => {
    const stored = localStorage.getItem("session");

    if (!stored) {
      router.push("/doctor/login");
      return;
    }

    const parsed = JSON.parse(stored);

    if (parsed.role !== "doctor") {
      router.push("/doctor/login");
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id,email,full_name")
      .eq("email", parsed.email)
      .maybeSingle();

    if (!user) {
      router.push("/doctor/login");
      return;
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("speciality")
      .eq("user_id", user.id)
      .eq("role", "doctor")
      .maybeSingle();

    setDoctor({
      id: user.id,
      email: user.email,
      name: user.full_name || "Doctor",
      speciality:
        roleRow?.speciality || "General",
    });
  };

  const loadSession = async () => {
    if (!doctor) return;

    const { data: latest } = await supabase
      .from("doctor_sessions")
      .select("*")
      .eq("doctor_id", doctor.id)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) {
      setSession(null);
      return;
    }

    const { data: patient } = await supabase
      .from("users")
      .select("full_name,email")
      .eq("id", latest.patient_id)
      .maybeSingle();

    setSession({
      patientName:
        patient?.full_name ||
        patient?.email ||
        "Patient",
    });
  };

  const logout = async () => {
    await fetch("/api/logout", {
      method: "POST",
    });

    localStorage.removeItem("session");

    router.push("/");
  };

  if (!doctor) {
    return (
      <div className="p-6">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <div className="flex justify-between items-center mb-8">

        <div>
          <h1 className="text-3xl font-bold">
            Doctor Dashboard
          </h1>

          <p className="text-gray-600">
            {doctor.name} ({doctor.speciality})
          </p>
        </div>

        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>

      </div>

      {session ? (
        <div className="bg-white p-6 rounded shadow mb-8 w-96">

          <h2 className="text-xl font-semibold mb-2">
            Patient Connected
          </h2>

          <p className="mb-4">
            {session.patientName}
          </p>

          <Link
            href="/doctor/patient"
            className="bg-indigo-600 text-white px-4 py-2 rounded"
          >
            Open Patient Record
          </Link>

        </div>
      ) : (
        <p className="text-gray-500 mb-8">
          Waiting for patient connection...
        </p>
      )}

      <div className="flex flex-col gap-4 w-64">

        <Link
          href="/doctor/patients"
          className="bg-blue-500 text-white p-4 rounded-lg text-center"
        >
          Patients Today
        </Link>

        <Link
          href="/doctor/appointments"
          className="bg-green-500 text-white p-4 rounded-lg text-center"
        >
          Appointments
        </Link>

        <Link
          href="/doctor/patient"
          className="bg-purple-500 text-white p-4 rounded-lg text-center"
        >
          Patient History
        </Link>

        <Link
          href="/doctor/qr"
          className="bg-orange-500 text-white p-4 rounded-lg text-center"
        >
          Generate QR
        </Link>

      </div>

    </div>
  );
}