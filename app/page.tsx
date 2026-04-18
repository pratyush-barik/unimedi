"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-[350px]">

        <h1 className="text-3xl font-bold text-indigo-600 mb-6">
          Unimedi
        </h1>

        <p className="text-gray-500 mb-8">
          Your digital medical companion
        </p>

        <div className="flex flex-col gap-4">

          <button
            onClick={() => router.push("/patient")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition"
          >
            Patient
          </button>

          <button
            onClick={() => router.push("/doctor/login")}
            className="bg-gray-800 hover:bg-black text-white py-3 rounded-lg transition"
          >
            Doctor
          </button>

        </div>

      </div>
    </div>
  );
}