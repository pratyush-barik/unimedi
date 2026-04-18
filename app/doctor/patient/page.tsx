"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PatientInfo = {
  id: string;
  full_name: string;
  email: string;
};

export default function DoctorPatientPage() {
  const router = useRouter();

  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [patient, setPatient] = useState<PatientInfo | null>(null);

  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConnectedPatient();
  }, []);

  const loadConnectedPatient = async () => {
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

      setDoctorEmail(session.email);

      const { data: doctorUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      if (!doctorUser) {
        setLoading(false);
        return;
      }

      setDoctorId(doctorUser.id);

      const { data: latest } = await supabase
        .from("doctor_sessions")
        .select("*")
        .eq("doctor_id", doctorUser.id)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest) {
        setLoading(false);
        return;
      }

      const { data: patientUser } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("id", latest.patient_id)
        .maybeSingle();

      if (patientUser) {
        setPatient(patientUser);
      }

    } catch {}

    setLoading(false);
  };

  const savePrescription = async () => {
    if (!patient || !doctorId) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("medical_records")
        .insert([
          {
            patient_id: patient.id,
            doctor_id: doctorId,
            diagnosis,
            medicines,
            notes,
          },
        ]);

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      // 🔹 Auto close session
      await supabase
        .from("doctor_sessions")
        .delete()
        .eq("patient_id", patient.id)
        .eq("doctor_id", doctorId);

      alert("Prescription saved successfully");

      router.push("/doctor/dashboard");

    } catch {
      setMessage("Failed to save");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        Loading patient...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-8 rounded-2xl shadow text-center">
          <h1 className="text-2xl font-bold mb-3">
            No Connected Patient
          </h1>

          <p className="text-gray-500 mb-6">
            Ask patient to scan your QR first.
          </p>

          <button
            onClick={() => router.push("/doctor/dashboard")}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-slate-200 p-6">

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold mb-2">
          Patient Prescription
        </h1>

        <p className="text-gray-500 mb-8">
          {patient.full_name || patient.email}
        </p>

        <div className="space-y-5">

          <textarea
            placeholder="Diagnosis"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            className="w-full border rounded-lg p-4 h-28"
          />

          <textarea
            placeholder="Medicines"
            value={medicines}
            onChange={(e) => setMedicines(e.target.value)}
            className="w-full border rounded-lg p-4 h-32"
          />

          <textarea
            placeholder="Doctor Notes / Advice"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg p-4 h-28"
          />

          <button
            onClick={savePrescription}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg"
          >
            {saving ? "Saving..." : "Save Prescription"}
          </button>

          <button
            onClick={() => router.push("/doctor/dashboard")}
            className="w-full bg-gray-200 py-3 rounded-lg"
          >
            Back to Dashboard
          </button>

          {message && (
            <p className="text-center text-sm text-gray-600">
              {message}
            </p>
          )}

        </div>

      </div>

    </div>
  );
}