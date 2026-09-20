"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";
import { MedicineItem, MedicalRecord, Vitals, LabTest } from "@/lib/types";
import PrescriptionPrintModal from "@/app/components/PrescriptionPrintModal";

type PatientInfo = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  blood_group?: string;
  gender?: string;
  date_of_birth?: string;
};

const COMMON_FREQUENCIES = ["1-0-1", "1-0-0", "0-0-1", "1-1-1", "1-1-0", "Once Daily", "As Needed (SOS)"];
const COMMON_DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month"];
const TIMINGS: ("After Food" | "Before Food" | "With Food" | "Anytime")[] = [
  "After Food",
  "Before Food",
  "With Food",
  "Anytime",
];

function DoctorPatientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryPatientId = searchParams.get("patientId");
  const queryAppointmentId = searchParams.get("appointmentId");

  const [doctorId, setDoctorId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorSpeciality, setDoctorSpeciality] = useState("");
  const [doctorHospital, setDoctorHospital] = useState("");

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(queryAppointmentId);

  // Security Gate State
  const [isSessionApproved, setIsSessionApproved] = useState(false);
  const [isCheckingConsent, setIsCheckingConsent] = useState(true);

  // Prescription Form State
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    {
      name: "",
      dosage: "1 tablet",
      frequency: "1-0-1",
      duration: "5 days",
      timing: "After Food",
      instructions: "",
    },
  ]);

  // Vitals State
  const [vitals, setVitals] = useState<Vitals>({
    bp: "",
    pulse: "",
    temperature: "",
    weight: "",
    spo2: "",
  });

  // Lab Tests State
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedRecord, setSavedRecord] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    loadSessionAndPatient();
  }, [queryPatientId]);

  const loadSessionAndPatient = async () => {
    try {
      const { authenticated, user } = await fetchCurrentSession();
      if (!authenticated || !user || user.role !== "doctor") {
        router.replace("/doctor/login");
        return;
      }

      setDoctorId(user.id);
      setDoctorName(user.full_name || "Doctor");
      setDoctorSpeciality(user.speciality || "General Physician");
      setDoctorHospital(user.hospital_affiliation || "UniMedi Clinic");

      let targetPatientId = queryPatientId;

      // If no query patient, check if there is an active session
      if (!targetPatientId) {
        const { data: latestSession } = await supabase
          .from("doctor_sessions")
          .select("patient_id, approved")
          .eq("doctor_id", user.id)
          .eq("approved", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSession) {
          targetPatientId = latestSession.patient_id;
        }
      }

      if (!targetPatientId) {
        setLoading(false);
        setIsCheckingConsent(false);
        return;
      }

      // CRITICAL IDOR VERIFICATION: Doctor can ONLY access patient data if an approved doctor_sessions row exists
      const { data: validSession } = await supabase
        .from("doctor_sessions")
        .select("id, approved")
        .eq("doctor_id", user.id)
        .eq("patient_id", targetPatientId)
        .eq("approved", true)
        .maybeSingle();

      if (!validSession) {
        // Access is restricted until patient grants consent
        setIsSessionApproved(false);

        // Fetch basic info for consent banner
        const { data: pUser } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("id", targetPatientId)
          .maybeSingle();

        if (pUser) {
          setPatient({
            id: pUser.id,
            full_name: pUser.full_name || "Patient",
            email: pUser.email,
          });
        }

        setIsCheckingConsent(false);
        setLoading(false);
        return;
      }

      // If session is approved, load full patient health profile
      setIsSessionApproved(true);
      const { data: patientUser } = await supabase
        .from("users")
        .select("id, full_name, email, phone, blood_group, gender, date_of_birth")
        .eq("id", targetPatientId)
        .maybeSingle();

      if (patientUser) {
        setPatient(patientUser);
      }
    } catch (e) {
      console.error("Error loading patient consultation:", e);
    } finally {
      setLoading(false);
      setIsCheckingConsent(false);
    }
  };

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      {
        name: "",
        dosage: "1 tablet",
        frequency: "1-0-1",
        duration: "5 days",
        timing: "After Food",
        instructions: "",
      },
    ]);
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index: number, field: keyof MedicineItem, value: string) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: value };
    setMedicines(updated);
  };

  const addLabTest = () => {
    setLabTests([
      ...labTests,
      {
        test_name: "",
        result: "",
        reference_range: "",
        notes: "",
      },
    ]);
  };

  const removeLabTest = (index: number) => {
    setLabTests(labTests.filter((_, i) => i !== index));
  };

  const updateLabTest = (index: number, field: keyof LabTest, value: string) => {
    const updated = [...labTests];
    updated[index] = { ...updated[index], [field]: value };
    setLabTests(updated);
  };

  const applyTemplate = (type: "cold" | "gastric" | "pain") => {
    if (type === "cold") {
      setDiagnosis("Upper Respiratory Tract Infection / Acute Viral Coryza");
      setMedicines([
        {
          name: "Paracetamol",
          dosage: "650mg",
          frequency: "1-0-1",
          duration: "3 days",
          timing: "After Food",
          instructions: "Take SOS if body temp > 99.5°F",
        },
        {
          name: "Cetirizine",
          dosage: "10mg",
          frequency: "0-0-1",
          duration: "5 days",
          timing: "After Food",
          instructions: "Take before bedtime",
        },
      ]);
      setNotes("Steam inhalation twice daily, plenty of warm fluids, rest well for 48 hours.");
    } else if (type === "gastric") {
      setDiagnosis("Acute Gastritis / Gastroesophageal Reflux Disease (GERD)");
      setMedicines([
        {
          name: "Pantoprazole",
          dosage: "40mg",
          frequency: "1-0-0",
          duration: "7 days",
          timing: "Before Food",
          instructions: "Take 30 minutes before breakfast",
        },
        {
          name: "Antacid Oral Suspension",
          dosage: "10ml",
          frequency: "As Needed (SOS)",
          duration: "5 days",
          timing: "After Food",
          instructions: "Take after meals if acidity persists",
        },
      ]);
      setNotes("Avoid oily, deep-fried, and spicy meals. Eat light and frequent meals.");
    } else if (type === "pain") {
      setDiagnosis("Acute Musculoskeletal Strain");
      setMedicines([
        {
          name: "Aceclofenac + Paracetamol",
          dosage: "100mg / 325mg",
          frequency: "1-0-1",
          duration: "3 days",
          timing: "After Food",
          instructions: "Do not take on an empty stomach",
        },
      ]);
      setNotes("Apply warm compress to affected muscle area; avoid strenuous exertion.");
    }
  };

  const savePrescription = async () => {
    if (!patient || !doctorId) return;

    const validMedicines = medicines.filter((m) => m.name.trim() !== "");
    if (!diagnosis.trim() && validMedicines.length === 0) {
      alert("Please enter a clinical diagnosis or at least one prescribed medication.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const validLabTests = labTests.filter((t) => t.test_name.trim() !== "");

      const { data: record, error } = await supabase
        .from("medical_records")
        .insert([
          {
            patient_id: patient.id,
            doctor_id: doctorId,
            appointment_id: appointmentId || null,
            diagnosis: diagnosis.trim() || "Clinical Consultation",
            medicines: validMedicines,
            vitals: vitals,
            lab_tests: validLabTests,
            notes: notes.trim(),
          },
        ])
        .select()
        .single();

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      // If appointment was linked, mark completed
      if (appointmentId) {
        await supabase
          .from("appointments")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", appointmentId);
      }

      // Close active session
      await supabase
        .from("doctor_sessions")
        .delete()
        .eq("patient_id", patient.id)
        .eq("doctor_id", doctorId);

      // Set record for print modal
      setSavedRecord({
        id: record.id,
        patient_id: patient.id,
        doctor_id: doctorId,
        diagnosis: diagnosis.trim() || "Clinical Consultation",
        medicines: validMedicines,
        vitals: vitals,
        lab_tests: validLabTests,
        notes: notes.trim(),
        created_at: new Date().toISOString(),
        doctorName: doctorName,
        doctorSpeciality: doctorSpeciality,
        doctorHospital: doctorHospital,
        patientName: patient.full_name || patient.email,
        patientEmail: patient.email,
      });
    } catch {
      setMessage("Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || isCheckingConsent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Verifying patient consultation authorization...
        </div>
      </div>
    );
  }

  // Security Barrier: Access Denied / Consent Pending
  if (!isSessionApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 flex items-center justify-center p-6">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200/80 max-w-lg text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
            🔒
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
            Patient Authorization Required
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Under UniMedi patient consent protocols, you can only access health records and issue prescriptions after the patient scans your clinic QR code and explicitly approves consultation access.
          </p>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 mb-6 text-left">
            <span className="font-bold text-slate-900 block mb-1">Status: Waiting for Patient Consent</span>
            Ask the patient ({patient?.full_name || "Patient"}) to open their UniMedi dashboard and tap <strong>Approve Access</strong>.
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={loadSessionAndPatient}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-xs transition"
            >
              🔄 Check Approval Status
            </button>
            <div className="flex gap-3">
              <Link
                href="/doctor/qr"
                className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold py-3 rounded-xl border border-orange-200 text-xs transition text-center"
              >
                Show Clinic QR
              </Link>
              <Link
                href="/doctor/appointments"
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-xs transition text-center"
              >
                Appointments Queue
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Bar */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold">
              👤
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {patient.full_name || "Patient"}
                </h1>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Consent Verified
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {patient.email} {patient.phone && `• ${patient.phone}`} {patient.blood_group && `• Blood: ${patient.blood_group}`}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Link
              href="/doctor/appointments"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition"
            >
              Appointments
            </Link>
            <Link
              href="/doctor/dashboard"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Quick Rx Templates Bar */}
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
            <span>⚡</span> Quick Rx Templates:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyTemplate("cold")}
              className="bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 transition"
            >
              + Viral Cold / Fever
            </button>
            <button
              type="button"
              onClick={() => applyTemplate("gastric")}
              className="bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 transition"
            >
              + Gastritis / Acidity
            </button>
            <button
              type="button"
              onClick={() => applyTemplate("pain")}
              className="bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 transition"
            >
              + Body Ache / Pain
            </button>
          </div>
        </div>

        {/* Prescription Form Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-8 space-y-6">
          {/* Section 1: Diagnosis */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>🩺</span> Diagnosis &amp; Clinical Findings *
            </label>
            <input
              type="text"
              placeholder="e.g. Acute Pharyngitis, Type 2 Diabetes follow-up, Hypertension..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          {/* Section 2: Patient Vitals */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>📊</span> Patient Vitals (Optional)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Blood Pressure</span>
                <input
                  type="text"
                  placeholder="120/80 mmHg"
                  value={vitals.bp || ""}
                  onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Pulse (bpm)</span>
                <input
                  type="text"
                  placeholder="72 bpm"
                  value={vitals.pulse || ""}
                  onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Temp (°F)</span>
                <input
                  type="text"
                  placeholder="98.6 °F"
                  value={vitals.temperature || ""}
                  onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">SpO2 (%)</span>
                <input
                  type="text"
                  placeholder="98%"
                  value={vitals.spo2 || ""}
                  onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Weight (kg)</span>
                <input
                  type="text"
                  placeholder="65 kg"
                  value={vitals.weight || ""}
                  onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Structured Medicines Builder */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="font-serif text-indigo-600 font-black text-lg">℞</span> Prescribed Medications
              </label>
              <button
                type="button"
                onClick={addMedicine}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                + Add Medicine
              </button>
            </div>

            <div className="space-y-3">
              {medicines.map((med, index) => (
                <div
                  key={index}
                  className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 relative space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-400">
                      Medicine #{index + 1}
                    </span>
                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Medicine Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Amoxicillin, Paracetamol"
                        value={med.name}
                        onChange={(e) => updateMedicine(index, "name", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Dosage
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 500mg / 1 tab"
                        value={med.dosage}
                        onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Frequency
                      </label>
                      <select
                        value={med.frequency}
                        onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {COMMON_FREQUENCIES.map((freq) => (
                          <option key={freq} value={freq}>
                            {freq}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Duration
                      </label>
                      <select
                        value={med.duration}
                        onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {COMMON_DURATIONS.map((dur) => (
                          <option key={dur} value={dur}>
                            {dur}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Food Timing
                      </label>
                      <select
                        value={med.timing}
                        onChange={(e) =>
                          updateMedicine(
                            index,
                            "timing",
                            e.target.value as "After Food" | "Before Food" | "With Food" | "Anytime"
                          )
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {TIMINGS.map((tim) => (
                          <option key={tim} value={tim}>
                            {tim}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Specific Directions / Instructions
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Take with warm water, avoid alcohol"
                        value={med.instructions || ""}
                        onChange={(e) => updateMedicine(index, "instructions", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Lab Tests Ordered */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>🧪</span> Ordered Diagnostic Tests (Optional)
              </label>
              <button
                type="button"
                onClick={addLabTest}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1 rounded-lg transition"
              >
                + Add Lab Test
              </button>
            </div>

            {labTests.length > 0 && (
              <div className="space-y-2">
                {labTests.map((test, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Test name (e.g. CBC, Serum Creatinine, Lipid Panel)"
                      value={test.test_name}
                      onChange={(e) => updateLabTest(idx, "test_name", e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Reference range / Notes"
                      value={test.notes || ""}
                      onChange={(e) => updateLabTest(idx, "notes", e.target.value)}
                      className="w-48 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeLabTest(idx)}
                      className="text-rose-500 font-bold text-xs px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Doctor Notes & Advice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>📝</span> Doctor Advice &amp; Lifestyle Guidance
            </label>
            <textarea
              placeholder="Dietary instructions, warning signs to watch for, or follow-up schedule..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none h-24"
            />
          </div>

          {message && (
            <p className="text-center text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {message}
            </p>
          )}

          {/* Save Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={savePrescription}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-xs transition text-center"
            >
              {saving ? "Saving Prescription..." : "Save & Complete Consultation"}
            </button>
            <Link
              href="/doctor/dashboard"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl text-center text-sm transition"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Saved Prescription Print Modal */}
      {savedRecord && (
        <PrescriptionPrintModal
          record={savedRecord}
          onClose={() => {
            setSavedRecord(null);
            router.push("/doctor/dashboard");
          }}
        />
      )}
    </div>
  );
}

export default function DoctorPatientPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-indigo-600 font-semibold text-sm">
          Loading clinical workspace...
        </div>
      }
    >
      <DoctorPatientContent />
    </Suspense>
  );
}