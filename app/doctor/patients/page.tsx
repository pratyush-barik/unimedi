"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";
import { MedicalRecord } from "@/lib/types";
import PrescriptionPrintModal from "@/app/components/PrescriptionPrintModal";

export default function DoctorPatientsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const { authenticated, user } = await fetchCurrentSession();

      if (!authenticated || !user || user.role !== "doctor") {
        router.replace("/doctor/login");
        return;
      }

      const { data: rows, error } = await supabase
        .from("medical_records")
        .select("*")
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false });

      if (error || !rows) {
        setRecords([]);
        return;
      }

      const enriched: MedicalRecord[] = [];
      for (const row of rows) {
        const { data: patientUser } = await supabase
          .from("users")
          .select("full_name, email, phone, blood_group")
          .eq("id", row.patient_id)
          .maybeSingle();

        enriched.push({
          id: row.id,
          patient_id: row.patient_id,
          doctor_id: row.doctor_id,
          appointment_id: row.appointment_id,
          diagnosis: row.diagnosis,
          medicines: row.medicines,
          notes: row.notes,
          vitals: row.vitals,
          lab_tests: row.lab_tests,
          created_at: row.created_at,
          doctorName: user.full_name || "Doctor",
          doctorSpeciality: user.speciality || "Specialist",
          doctorHospital: user.hospital_affiliation || "UniMedi Clinic",
          patientName: patientUser?.full_name || "Patient",
          patientEmail: patientUser?.email || "",
        });
      }

      setRecords(enriched);
    } catch (e) {
      console.error("Error loading doctor patients history:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Loading treated patients history...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Treated Patients &amp; Consultation History
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Historical archive of clinical consultations, prescribed medications, and diagnoses
            </p>
          </div>

          <Link
            href="/doctor/dashboard"
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-sm shadow-xs transition"
          >
            &larr; Dashboard
          </Link>
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              👥
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Consultations Recorded Yet</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Prescriptions issued through the consultation workspace will be automatically logged here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      {rec.patientName}
                    </h3>
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Rx #{rec.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {rec.patientEmail} • Consulted on {new Date(rec.created_at).toLocaleDateString()}
                  </p>

                  <div className="mt-2 text-xs font-semibold text-slate-700">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Diagnosis: </span>
                    {rec.diagnosis}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <button
                    onClick={() => setSelectedRecordForPrint(rec)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <span>🖨️</span> View &amp; Print Rx
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRecordForPrint && (
        <PrescriptionPrintModal
          record={selectedRecordForPrint}
          onClose={() => setSelectedRecordForPrint(null)}
        />
      )}
    </div>
  );
}