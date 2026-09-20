"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Appointment, AppointmentStatus } from "@/lib/types";

type DoctorOption = {
  id: string;
  full_name: string;
  email: string;
  speciality: string;
};

const TIME_SLOTS = [
  "09:00 AM - 09:30 AM",
  "09:30 AM - 10:00 AM",
  "10:00 AM - 10:30 AM",
  "10:30 AM - 11:00 AM",
  "11:30 AM - 12:00 PM",
  "02:00 PM - 02:30 PM",
  "02:30 PM - 03:00 PM",
  "03:30 PM - 04:00 PM",
  "04:00 PM - 04:30 PM",
  "05:00 PM - 05:30 PM",
];

export default function PatientAppointmentsPage() {
  const router = useRouter();

  const [patientId, setPatientId] = useState<string>("");
  const [patientEmail, setPatientEmail] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"book" | "upcoming" | "history">("upcoming");

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[0]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    initPatient();
  }, []);

  const initPatient = async () => {
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

      setPatientEmail(session.email);

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      if (!user) {
        router.push("/patient/signin");
        return;
      }

      setPatientId(user.id);
      await Promise.all([loadDoctors(), loadAppointments(user.id)]);
    } catch {
      setMessage({ text: "Failed to load session", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, speciality")
        .eq("role", "doctor");

      if (!roles || roles.length === 0) return;

      const doctorList: DoctorOption[] = [];
      for (const r of roles) {
        const { data: u } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("id", r.user_id)
          .maybeSingle();

        if (u) {
          doctorList.push({
            id: u.id,
            full_name: u.full_name || "Doctor",
            email: u.email,
            speciality: r.speciality || "General Physician",
          });
        }
      }

      setDoctors(doctorList);
      if (doctorList.length > 0) {
        setSelectedDoctorId(doctorList[0].id);
      }
    } catch (e) {
      console.error("Error loading doctors:", e);
    }
  };

  const loadAppointments = async (pId: string) => {
    try {
      const { data: rows } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", pId)
        .order("appointment_date", { ascending: false });

      if (!rows) {
        setAppointments([]);
        return;
      }

      const enriched: Appointment[] = [];
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
          ...row,
          doctor: {
            full_name: docUser?.full_name || "Doctor",
            email: docUser?.email || "",
            speciality: docRole?.speciality || "General Practice",
          },
        });
      }

      setAppointments(enriched);
    } catch (e) {
      console.error("Error loading appointments:", e);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedSlot) {
      setMessage({ text: "Please fill in all required fields", type: "error" });
      return;
    }

    setBookingLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.from("appointments").insert([
        {
          patient_id: patientId,
          doctor_id: selectedDoctorId,
          appointment_date: selectedDate,
          time_slot: selectedSlot,
          type: "online_booking",
          status: "pending",
          reason_for_visit: reason,
        },
      ]);

      if (error) {
        setMessage({ text: error.message, type: "error" });
        setBookingLoading(false);
        return;
      }

      setMessage({ text: "Appointment scheduled successfully!", type: "success" });
      setReason("");
      await loadAppointments(patientId);
      setActiveTab("upcoming");
    } catch (err: any) {
      setMessage({ text: err?.message || "Failed to book appointment", type: "error" });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (!error) {
        await loadAppointments(patientId);
      }
    } catch (e) {
      console.error("Failed to cancel appointment:", e);
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "confirmed":
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold">Confirmed</span>;
      case "pending":
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">Pending Approval</span>;
      case "in_consultation":
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse">In Consultation</span>;
      case "completed":
        return <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full text-xs font-semibold">Completed</span>;
      case "cancelled":
        return <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full text-xs font-semibold">Cancelled</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  const upcomingList = appointments.filter(
    (a) => a.status === "pending" || a.status === "confirmed" || a.status === "in_consultation"
  );
  const historyList = appointments.filter(
    (a) => a.status === "completed" || a.status === "cancelled"
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-indigo-600 font-medium animate-pulse">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-slate-50 to-blue-50/50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Top Navigation / Breadcrumb */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Appointments & Consultations
            </h1>
            <p className="text-gray-500 mt-1">
              Schedule visits, manage bookings, and join instant walk-in queues.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/patient/connect"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition flex items-center gap-2"
            >
              <span>📷</span> Walk-in QR Check-in
            </Link>
            <button
              onClick={() => router.push("/patient/dashboard")}
              className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 font-medium transition"
            >
              Back
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {message && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-8 bg-white/70 backdrop-blur-sm p-1.5 rounded-2xl shadow-xs">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === "upcoming"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Upcoming ({upcomingList.length})
          </button>
          <button
            onClick={() => setActiveTab("book")}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === "book"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            + Book Appointment
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Past History ({historyList.length})
          </button>
        </div>

        {/* TAB 1: UPCOMING APPOINTMENTS */}
        {activeTab === "upcoming" && (
          <div>
            {upcomingList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  📅
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No upcoming appointments</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                  You don't have any pending or confirmed bookings at the moment. Book a slot or scan the doctor's QR for a walk-in visit.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setActiveTab("book")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition"
                  >
                    Book New Appointment
                  </button>
                  <Link
                    href="/patient/connect"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-xl font-medium transition"
                  >
                    Scan Walk-in QR
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {upcomingList.map((apt) => (
                  <div
                    key={apt.id}
                    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg shrink-0">
                        👨‍⚕️
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg text-gray-900">
                            Dr. {apt.doctor?.full_name}
                          </h3>
                          {getStatusBadge(apt.status)}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                            {apt.type === "walk_in_qr" ? "Walk-in QR" : "Online Slot"}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-indigo-600">
                          {apt.doctor?.speciality}
                        </p>
                        <div className="flex flex-wrap gap-y-1 gap-x-4 mt-2 text-xs text-gray-500 font-medium">
                          <span>🗓️ {new Date(apt.appointment_date).toLocaleDateString()}</span>
                          <span>⏰ {apt.time_slot}</span>
                          {apt.reason_for_visit && (
                            <span className="text-gray-700">💬 Reason: {apt.reason_for_visit}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {apt.status === "pending" && (
                        <button
                          onClick={() => handleCancelAppointment(apt.id)}
                          className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-4 py-2 rounded-lg transition"
                        >
                          Cancel Booking
                        </button>
                      )}
                      {apt.status === "confirmed" && (
                        <Link
                          href="/patient/connect"
                          className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-4 py-2 rounded-lg transition"
                        >
                          Check-in QR
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BOOK APPOINTMENT FORM */}
        {activeTab === "book" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Book Doctor Consultation</h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose your doctor, pick a convenient date & time slot, and describe your symptoms.
            </p>

            <form onSubmit={handleBookAppointment} className="space-y-6">
              {/* Doctor Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Doctor *
                </label>
                {doctors.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No active doctors found in database. Doctors must register an account first.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {doctors.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                          selectedDoctorId === doc.id
                            ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 shadow-xs"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <p className="font-bold text-sm">Dr. {doc.full_name}</p>
                        <p className="text-xs text-indigo-600 font-medium">{doc.speciality}</p>
                        <p className="text-[11px] text-gray-400 mt-1 font-mono">{doc.email}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              {/* Time Slot Picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preferred Time Slot *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-2.5 rounded-lg text-xs font-semibold border transition ${
                        selectedSlot === slot
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason for Visit */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Visit / Symptoms
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Mild fever, dry cough for 3 days, routine blood check review..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none h-24"
                />
              </div>

              <button
                type="submit"
                disabled={bookingLoading || doctors.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl shadow-sm transition flex justify-center items-center gap-2"
              >
                {bookingLoading ? "Scheduling..." : "Confirm & Request Appointment"}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: PAST APPOINTMENTS HISTORY */}
        {activeTab === "history" && (
          <div>
            {historyList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                No past appointment history available.
              </div>
            ) : (
              <div className="grid gap-4">
                {historyList.map((apt) => (
                  <div
                    key={apt.id}
                    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900">Dr. {apt.doctor?.full_name}</h3>
                        {getStatusBadge(apt.status)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {apt.doctor?.speciality} • {new Date(apt.appointment_date).toLocaleDateString()} ({apt.time_slot})
                      </p>
                      {apt.reason_for_visit && (
                        <p className="text-xs text-gray-600 mt-1">Reason: {apt.reason_for_visit}</p>
                      )}
                    </div>

                    {apt.status === "completed" && (
                      <Link
                        href="/patient/prescriptions"
                        className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-4 py-2 rounded-lg transition"
                      >
                        View Prescription
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}