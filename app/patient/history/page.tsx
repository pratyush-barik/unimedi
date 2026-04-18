"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RecordItem = {
  id: string;
  diagnosis: string;
  medicines: string;
  notes: string;
  created_at: string;
  doctorName: string;
};

export default function PatientHistoryPage() {
  const router = useRouter();

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = localStorage.getItem("session");

      if (!stored) {
        router.push("/patient/signin");
        return;
      }

      const session = JSON.parse(stored);

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      if (!user) {
        router.push("/patient/signin");
        return;
      }

      const { data: rows } = await supabase
        .from("medical_records")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });

      const finalRows: RecordItem[] = [];

      for (const row of rows || []) {
        const { data: doctor } = await supabase
          .from("users")
          .select("full_name,email")
          .eq("id", row.doctor_id)
          .maybeSingle();

        finalRows.push({
          id: row.id,
          diagnosis: row.diagnosis,
          medicines: row.medicines,
          notes: row.notes,
          created_at: row.created_at,
          doctorName:
            doctor?.full_name ||
            doctor?.email ||
            "Doctor",
        });
      }

      setRecords(finalRows);

    } catch {
      router.push("/patient/dashboard");
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        Loading History...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-6">

      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">

          <h1 className="text-3xl font-bold text-indigo-600 mb-2">
            Medical History
          </h1>

          <p className="text-gray-500">
            Prescriptions & Previous Records
          </p>

        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500">
            No medical records found.
          </div>
        ) : (
          <div className="space-y-5">

            {records.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow p-6"
              >

                <div className="flex justify-between mb-4">

                  <div>
                    <h2 className="text-xl font-semibold text-indigo-600">
                      {item.doctorName}
                    </h2>

                    <p className="text-sm text-gray-500">
                      Consulting Doctor
                    </p>
                  </div>

                  <span className="text-sm text-gray-400">
                    {new Date(
                      item.created_at
                    ).toLocaleDateString()}
                  </span>

                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-red-500 mb-1">
                    Diagnosis
                  </h3>

                  <p className="text-gray-700">
                    {item.diagnosis || "N/A"}
                  </p>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-green-600 mb-1">
                    Medicines
                  </h3>

                  <p className="text-gray-700 whitespace-pre-wrap">
                    {item.medicines || "N/A"}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-orange-500 mb-1">
                    Notes
                  </h3>

                  <p className="text-gray-700 whitespace-pre-wrap">
                    {item.notes || "N/A"}
                  </p>
                </div>

              </div>
            ))}

          </div>
        )}

        <button
          onClick={() => router.push("/patient/dashboard")}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl"
        >
          Back to Dashboard
        </button>

      </div>

    </div>
  );
}