"use client";

import { useRouter } from "next/navigation";

export default function PatientOptions() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-[350px] text-center">

        <h2 className="text-2xl font-bold text-indigo-600 mb-6">
          Patient Portal
        </h2>

        <div className="flex flex-col gap-4">

          <button
            onClick={() => router.push("/patient/signin")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition"
          >
            Sign In
          </button>

          <button
            onClick={() => router.push("/patient/signup")}
            className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg transition"
          >
            Signup
          </button>

        </div>

      </div>
    </div>
  );
}