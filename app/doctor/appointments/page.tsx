"use client";

import { useRouter } from "next/navigation";

export default function DoctorAppointmentsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl p-10 text-center">

        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Doctor Appointments
        </h1>

        <p className="text-gray-500 mb-8">
          Smart appointment management module coming soon.
        </p>

        <button
          onClick={() => router.push("/doctor/dashboard")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg"
        >
          Back to Dashboard
        </button>

      </div>

    </div>
  );
}