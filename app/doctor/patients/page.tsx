"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PatientRow = {
  name: string;
  email: string;
  created_at: string;
};

export default function DoctorPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
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

      const { data: doctor } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      if (!doctor) {
        router.push("/doctor/login");
        return;
      }

      const { data: records } = await supabase
        .from("medical_records")
        .select("*")
        .eq("doctor_id", doctor.id)
        .order("created_at", { ascending: false });

      const seen = new Set<string>();
      const finalRows: PatientRow[] = [];

      for (const row of records || []) {
        if (seen.has(row.patient_id)) continue;

        seen.add(row.patient_id);

        const { data: patient } = await supabase
          .from("users")
          .select("full_name,email")
          .eq("id", row.patient_id)
          .maybeSingle();

        if (patient) {
          finalRows.push({
            name:
              patient.full_name ||
              "Patient",
            email: patient.email,
            created_at: row.created_at,
          });
        }
      }

      setPatients(finalRows);

    } catch {}

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        Loading patients...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">

          <h1 className="text-3xl font-bold">
            Patients Today
          </h1>

          <p className="text-gray-500 mt-2">
            Recently treated patients
          </p>

        </div>

        {patients.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500">
            No treated patients yet.
          </div>
        ) : (
          <div className="space-y-4">

            {patients.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow p-6 flex justify-between items-center"
              >
                <div>
                  <h2 className="text-xl font-semibold text-indigo-600">
                    {item.name}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {item.email}
                  </p>
                </div>

                <div className="text-sm text-gray-400">
                  {new Date(
                    item.created_at
                  ).toLocaleString()}
                </div>
              </div>
            ))}

          </div>
        )}

        <button
          onClick={() => router.push("/doctor/dashboard")}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl"
        >
          Back to Dashboard
        </button>

      </div>

    </div>
  );
}