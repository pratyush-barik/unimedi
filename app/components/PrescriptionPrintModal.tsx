"use client";

import React from "react";
import { MedicalRecord, MedicineItem, Vitals, LabTest } from "@/lib/types";

interface PrescriptionPrintModalProps {
  record: MedicalRecord | null;
  onClose: () => void;
}

export default function PrescriptionPrintModal({
  record,
  onClose,
}: PrescriptionPrintModalProps) {
  if (!record) return null;

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

  const medicineList = parseMedicines(record.medicines);
  const vitals = (record.vitals || {}) as Vitals;
  const labTests = (record.lab_tests || []) as LabTest[];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-8 relative print:shadow-none print:w-full print:max-w-none print:p-6 print:rounded-none">
        {/* Controls - Hidden during print */}
        <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100 print:hidden">
          <h2 className="text-lg font-bold text-slate-900">
            Digital Clinical Prescription
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition"
            >
              <span>🖨️</span> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-semibold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Prescription Body */}
        <div className="border border-indigo-100 rounded-2xl p-6 bg-slate-50/40 print:border-none print:p-0 print:bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-black text-indigo-600 tracking-tight">
                  UNIMEDI
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Verified Clinical Rx
                </span>
              </div>
              <p className="text-base font-extrabold text-slate-900">
                Dr. {record.doctorName || "Doctor"}
              </p>
              <p className="text-xs font-semibold text-indigo-600">
                {record.doctorSpeciality || "General Practitioner"}
              </p>
              <p className="text-[11px] text-slate-400">
                {record.doctorHospital || "UniMedi Campus Health Centre"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400 font-mono">
                RX #{record.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-slate-700 mt-1 font-semibold">
                Date: {new Date(record.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Patient Details */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/80 mb-5 flex flex-wrap justify-between gap-4 print:border-slate-300">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Patient Name
              </span>
              <span className="text-sm font-bold text-slate-900">
                {record.patientName || "Patient"}
              </span>
            </div>
            {record.patientEmail && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Patient Email / ID
                </span>
                <span className="text-xs text-slate-600 font-mono">
                  {record.patientEmail}
                </span>
              </div>
            )}
          </div>

          {/* Vitals (if present) */}
          {(vitals.bp || vitals.pulse || vitals.temperature || vitals.spo2 || vitals.weight) && (
            <div className="mb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Recorded Patient Vitals
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                {vitals.bp && (
                  <span className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
                    BP: <b>{vitals.bp}</b>
                  </span>
                )}
                {vitals.pulse && (
                  <span className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
                    Pulse: <b>{vitals.pulse} bpm</b>
                  </span>
                )}
                {vitals.temperature && (
                  <span className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
                    Temp: <b>{vitals.temperature}</b>
                  </span>
                )}
                {vitals.spo2 && (
                  <span className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
                    SpO2: <b>{vitals.spo2}</b>
                  </span>
                )}
                {vitals.weight && (
                  <span className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
                    Weight: <b>{vitals.weight}</b>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Diagnosis */}
          <div className="mb-5">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">
              🩺 Diagnosis &amp; Clinical Findings
            </span>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 text-slate-900 font-semibold text-xs print:border-slate-300">
              {record.diagnosis || "General Consultation"}
            </div>
          </div>

          {/* Prescribed Medications */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-serif font-black text-indigo-600 italic">
                ℞
              </span>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                Prescribed Medications &amp; Schedule
              </span>
            </div>

            {medicineList.length > 0 ? (
              <div className="overflow-hidden border border-slate-200 rounded-xl bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Medicine</th>
                      <th className="px-4 py-2.5 text-left">Dosage</th>
                      <th className="px-4 py-2.5 text-center">Frequency</th>
                      <th className="px-4 py-2.5 text-center">Duration</th>
                      <th className="px-4 py-2.5 text-left">Timing &amp; Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicineList.map((med, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {med.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {med.dosage || "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-bold">
                            {med.frequency}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-700 font-medium">
                          {med.duration}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          <span className="font-bold text-slate-800">
                            {med.timing}
                          </span>
                          {med.instructions && (
                            <p className="text-slate-500 mt-0.5">{med.instructions}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white p-3 rounded-xl border text-slate-500 text-xs">
                No medications prescribed.
              </div>
            )}
          </div>

          {/* Lab Tests Ordered (if present) */}
          {labTests.length > 0 && (
            <div className="mb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                🧪 Ordered Lab &amp; Diagnostic Investigations
              </span>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                {labTests.map((t, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="font-bold text-slate-900">{t.test_name}</span>
                    <span className="text-slate-500">{t.notes || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Doctor's Advice & Notes */}
          {record.notes && (
            <div className="mb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Doctor Advice &amp; Lifestyle Guidance
              </span>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-slate-700 text-xs whitespace-pre-wrap print:border-slate-300">
                {record.notes}
              </div>
            </div>
          )}

          {/* Footer Signature Block */}
          <div className="mt-8 pt-5 border-t border-dashed border-slate-300 flex justify-between items-end">
            <div className="text-[10px] text-slate-400">
              <p>Generated securely via UniMedi Platform.</p>
              <p>Standardized digital medical prescription slip.</p>
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-slate-800 mb-1"></div>
              <p className="text-xs font-bold text-slate-900">
                Dr. {record.doctorName || "Doctor"}
              </p>
              <p className="text-[9px] text-slate-400 font-semibold uppercase">Authorized Practitioner</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
