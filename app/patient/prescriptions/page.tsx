"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MedicalRecord, MedicineItem } from "@/lib/types";
import PrescriptionPrintModal from "@/app/components/PrescriptionPrintModal";

export default function PatientPrescriptionsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const loadPrescriptions = async () => {
    try {
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

      const { data: user } = await supabase
        .from("users")
        .select("id, full_name, email")
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

      if (!rows || rows.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const enriched: MedicalRecord[] = [];
      for (const row of rows) {
        const { data: docUser } = await supabase
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

        enriched.push({
          id: row.id,
          patient_id: row.patient_id,
          doctor_id: row.doctor_id,
          appointment_id: row.appointment_id,
          diagnosis: row.diagnosis,
          medicines: row.medicines,
          notes: row.notes,
          created_at: row.created_at,
          doctorName: docUser?.full_name || "Doctor",
          doctorSpeciality: docRole?.speciality || "Specialist",
          patientName: user.full_name || "Patient",
          patientEmail: user.email,
        });
      }

      setRecords(enriched);
    } catch (e) {
      console.error("Error loading prescriptions:", e);
    } finally {
      setLoading(false);
    }
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
        <div className="text-indigo-600 font-medium animate-pulse">
          Loading digital prescriptions...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-slate-50 to-blue-50/50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              My Digital Prescriptions
            </h1>
            <p className="text-gray-500 mt-1">
              Access your clinical prescriptions, dosage guides, and printable pharmacy slips.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/patient/appointments"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition"
            >
              Book Appointment
            </Link>
            <button
              onClick={() => router.push("/patient/dashboard")}
              className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 font-medium transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Prescription List */}
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold font-serif">
              ℞
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Prescriptions Found</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              When a doctor consults with you and issues a prescription, it will appear here automatically with detailed dosage guidance.
            </p>
            <Link
              href="/patient/appointments"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition"
            >
              Book Doctor Consultation
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {records.map((rec) => {
              const meds = parseMedicines(rec.medicines);

              return (
                <div
                  key={rec.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-6 bg-slate-50/70 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-indigo-600 font-black text-xl">℞</span>
                        <h2 className="text-lg font-bold text-gray-900">
                          Dr. {rec.doctorName}
                        </h2>
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-0.5 rounded-full">
                          {rec.doctorSpeciality}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Prescribed on {new Date(rec.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedRecordForPrint(rec)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    >
                      <span>🖨️</span> Print / Save PDF
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-5">
                    {/* Diagnosis */}
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Diagnosis / Clinical Indication
                      </span>
                      <p className="text-sm font-semibold text-gray-800 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                        {rec.diagnosis || "General Consultation"}
                      </p>
                    </div>

                    {/* Medicines Table */}
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                        Prescribed Medicines & Dosage
                      </span>
                      {meds.length > 0 ? (
                        <div className="overflow-x-auto border border-gray-100 rounded-xl">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                              <tr>
                                <th className="px-4 py-2.5 text-left">Medicine</th>
                                <th className="px-4 py-2.5 text-left">Dosage</th>
                                <th className="px-4 py-2.5 text-center">Frequency</th>
                                <th className="px-4 py-2.5 text-center">Duration</th>
                                <th className="px-4 py-2.5 text-left">Timing & Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {meds.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-semibold text-gray-900">
                                    {m.name}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-600">
                                    {m.dosage || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-xs">
                                      {m.frequency}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                                    {m.duration}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-600">
                                    <span className="font-semibold text-gray-800 block">
                                      {m.timing}
                                    </span>
                                    {m.instructions && (
                                      <span className="text-gray-500">{m.instructions}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No structured medicines specified.</p>
                      )}
                    </div>

                    {/* Doctor Advice / Notes */}
                    {rec.notes && (
                      <div className="border-t border-gray-100 pt-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                          Doctor Advice & Instructions
                        </span>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">
                          {rec.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print / Save PDF Modal */}
      {selectedRecordForPrint && (
        <PrescriptionPrintModal
          record={selectedRecordForPrint}
          onClose={() => setSelectedRecordForPrint(null)}
        />
      )}
    </div>
  );
}