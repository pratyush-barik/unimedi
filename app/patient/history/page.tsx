"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MedicalRecord, MedicineItem } from "@/lib/types";
import PrescriptionPrintModal from "@/app/components/PrescriptionPrintModal";
import { fetchCurrentSession } from "@/lib/authClient";

export default function PatientHistoryPage() {
  const router = useRouter();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { authenticated, user: sessionUser } = await fetchCurrentSession();

      if (!authenticated || !sessionUser || sessionUser.role !== "patient") {
        router.push("/patient/signin");
        return;
      }

      const { data: user } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("email", sessionUser.email)
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

      const finalRows: MedicalRecord[] = [];

      for (const row of rows || []) {
        const { data: doctor } = await supabase
          .from("users")
          .select("full_name, email")
          .eq("id", row.doctor_id)
          .maybeSingle();

        const { data: docRole } = await supabase
          .from("user_roles")
          .select("speciality")
          .eq("user_id", row.doctor_id)
          .eq("role", "doctor")
          .maybeSingle();

        finalRows.push({
          id: row.id,
          patient_id: row.patient_id,
          doctor_id: row.doctor_id,
          diagnosis: row.diagnosis,
          medicines: row.medicines,
          notes: row.notes,
          created_at: row.created_at,
          doctorName: doctor?.full_name || "Doctor",
          doctorSpeciality: docRole?.speciality || "General Practitioner",
          patientName: user.full_name || "Patient",
          patientEmail: user.email,
        });
      }

      setRecords(finalRows);
    } catch {
      router.push("/patient/dashboard");
    }

    setLoading(false);
  };

  const parseMedicines = (meds: MedicineItem[] | string): MedicineItem[] => {
    if (Array.isArray(meds)) return meds;
    if (typeof meds === "string") {
      try {
        const parsed = JSON.parse(meds);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [
          {
            name: meds,
            dosage: "-",
            frequency: "-",
            duration: "-",
            timing: "After Food",
            instructions: "",
          },
        ];
      }
    }
    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-indigo-600 font-medium animate-pulse">Loading History...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-slate-50 to-blue-50/50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight">
              Medical History
            </h1>
            <p className="text-gray-500 mt-1">
              Consultation history, past diagnoses, and prescribed treatments
            </p>
          </div>

          <button
            onClick={() => router.push("/patient/dashboard")}
            className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 font-medium transition"
          >
            Dashboard
          </button>
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center text-gray-500">
            No medical records found.
          </div>
        ) : (
          <div className="space-y-6">
            {records.map((item) => {
              const meds = parseMedicines(item.medicines);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7 space-y-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start pb-3 border-b border-gray-100">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Dr. {item.doctorName}
                      </h2>
                      <p className="text-xs font-semibold text-indigo-600">
                        {item.doctorSpeciality}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-medium">
                        {new Date(item.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <button
                        onClick={() => setSelectedRecordForPrint(item)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        <span>🖨️</span> PDF Rx
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Diagnosis
                    </h3>
                    <p className="text-sm font-semibold text-gray-800">
                      {item.diagnosis || "N/A"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Medications
                    </h3>
                    {meds.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {meds.map((m, i) => (
                          <div
                            key={i}
                            className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs"
                          >
                            <span className="font-bold text-gray-900">{m.name}</span>
                            {m.dosage && <span className="text-gray-500"> ({m.dosage})</span>}
                            <span className="mx-1 text-indigo-600 font-semibold">• {m.frequency}</span>
                            <span className="text-gray-500">• {m.duration}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No medications recorded.</p>
                    )}
                  </div>

                  {item.notes && (
                    <div className="pt-2 border-t border-gray-50">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Doctor Notes
                      </h3>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{item.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => router.push("/patient/dashboard")}
          className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-2xl transition shadow-xs"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Print Modal */}
      {selectedRecordForPrint && (
        <PrescriptionPrintModal
          record={selectedRecordForPrint}
          onClose={() => setSelectedRecordForPrint(null)}
        />
      )}
    </div>
  );
}