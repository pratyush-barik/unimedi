"use client";

type MedicalRecord = {
  date: string;
  hospital: string;
  diagnosis: string;
};

export default function PatientPrescriptions() {

  const records: MedicalRecord[] =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("medicalRecords") || "[]")
      : [];

  return (
    <div className="p-8">

      <h1 className="text-2xl font-bold mb-6">
        Prescriptions
      </h1>

      <div className="bg-white p-6 rounded shadow">

        {records.length === 0 ? (
          <p className="text-gray-600">
            No prescriptions available.
          </p>
        ) : (

          records.map((r, i) => (

            <div key={i} className="border-b py-2">

              <p><b>Date:</b> {r.date}</p>
              <p><b>Hospital:</b> {r.hospital}</p>
              <p><b>Diagnosis:</b> {r.diagnosis}</p>

            </div>

          ))

        )}

      </div>

    </div>
  );
}