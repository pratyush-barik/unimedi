"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserData = {
  name: string;
  email: string;
};

export default function PatientDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const stored = localStorage.getItem("session");

    if (!stored) {
      router.push("/patient/signin");
      return;
    }

    const session = JSON.parse(stored);

    if (session.role !== "patient") {
      router.push("/patient/signin");
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("full_name,email")
      .eq("email", session.email)
      .maybeSingle();

    setUser({
      name:
        data?.full_name ||
        session.name ||
        "Patient",
      email: session.email,
    });
  };

  const logout = async () => {
    await fetch("/api/logout", {
      method: "POST",
    });

    localStorage.removeItem("session");

    router.push("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-6">

      <div className="max-w-5xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 flex justify-between items-center">

          <div>
            <h1 className="text-3xl font-bold text-indigo-600">
              Patient Dashboard
            </h1>

            <p className="text-gray-500 mt-1">
              Welcome, {user.name}
            </p>

            <p className="text-sm text-gray-400">
              {user.email}
            </p>
          </div>

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-lg"
          >
            Logout
          </button>

        </div>

        <div className="grid md:grid-cols-2 gap-6">

          <Link
            href="/patient/history"
            className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold text-indigo-600 mb-2">
              Medical History
            </h2>

            <p className="text-gray-500">
              View prescriptions and previous records
            </p>
          </Link>

          <Link
            href="/patient/profile"
            className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold text-green-600 mb-2">
              My Profile
            </h2>

            <p className="text-gray-500">
              Personal and health details
            </p>
          </Link>

          <Link
            href="/patient/connect"
            className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold text-purple-600 mb-2">
              Connect to Doctor
            </h2>

            <p className="text-gray-500">
              Scan QR and allow consultation
            </p>
          </Link>

          <Link
            href="/patient/appointments"
            className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold text-orange-500 mb-2">
              Appointments
            </h2>

            <p className="text-gray-500">
              Upcoming bookings and visits
            </p>
          </Link>

        </div>

      </div>

    </div>
  );
}