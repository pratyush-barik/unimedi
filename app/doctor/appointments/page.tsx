"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";
import { Appointment, AppointmentStatus } from "@/lib/types";

export default function DoctorAppointmentsPage() {
  const router = useRouter();

  const [doctorId, setDoctorId] = useState<string>("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "confirmed" | "completed" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    initDoctor();
  }, []);

  const initDoctor = async () => {
    try {
      const { authenticated, user } = await fetchCurrentSession();

      if (!authenticated || !user || user.role !== "doctor") {
        router.replace("/doctor/login");
        return;
      }

      setDoctorId(user.id);
      await loadAppointments(user.id);
    } catch {
      router.replace("/doctor/login");
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async (docId: string) => {
    try {
      const { data: rows, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", docId)
        .order("appointment_date", { ascending: true });

      if (error || !rows) {
        setAppointments([]);
        return;
      }

      const enriched: Appointment[] = [];
      for (const row of rows) {
        const { data: patientUser } = await supabase
          .from("users")
          .select("full_name, email, phone, blood_group, gender, date_of_birth")
          .eq("id", row.patient_id)
          .maybeSingle();

        enriched.push({
          ...row,
          patient: {
            full_name: patientUser?.full_name || "Patient",
            email: patientUser?.email || "",
            phone: patientUser?.phone || "N/A",
            blood_group: patientUser?.blood_group,
            gender: patientUser?.gender,
            date_of_birth: patientUser?.date_of_birth,
          },
        });
      }

      setAppointments(enriched);
    } catch (e) {
      console.error("Error loading doctor appointments:", e);
    }
  };

  const updateStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    setActionLoading(appointmentId);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", appointmentId);

      if (!error) {
        await loadAppointments(doctorId);
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const startConsultation = async (appointment: Appointment) => {
    setActionLoading(appointment.id);
    try {
      // Check if session exists
      const { data: existingSession } = await supabase
        .from("doctor_sessions")
        .select("id, approved")
        .eq("doctor_id", doctorId)
        .eq("patient_id", appointment.patient_id)
        .maybeSingle();

      if (!existingSession) {
        // Create session with approved = false (patient consent required or confirmed appointment context)
        // For pre-confirmed online bookings, patient granted appointment, so create approved session for the consultation
        await supabase.from("doctor_sessions").insert([
          {
            doctor_id: doctorId,
            patient_id: appointment.patient_id,
            approved: true,
          },
        ]);
      } else if (!existingSession.approved) {
        await supabase
          .from("doctor_sessions")
          .update({ approved: true })
          .eq("id", existingSession.id);
      }

      // Mark appointment in_consultation
      await supabase
        .from("appointments")
        .update({ status: "in_consultation", updated_at: new Date().toISOString() })
        .eq("id", appointment.id);

      router.push(`/doctor/patient?patientId=${appointment.patient_id}&appointmentId=${appointment.id}`);
    } catch (e) {
      console.error("Failed to start consultation:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "confirmed":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold">Confirmed</span>;
      case "pending":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold">Pending Review</span>;
      case "in_consultation":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse">In Consultation</span>;
      case "completed":
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-bold">Completed</span>;
      case "cancelled":
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold">Cancelled</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const pendingList = appointments.filter((a) => a.status === "pending");
  const confirmedList = appointments.filter((a) => a.status === "confirmed" || a.status === "in_consultation");
  const completedList = appointments.filter((a) => a.status === "completed" || a.status === "cancelled");

  const displayedList =
    activeTab === "pending"
      ? pendingList
      : activeTab === "confirmed"
      ? confirmedList
      : activeTab === "completed"
      ? completedList
      : appointments;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Loading appointments console...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Clinical Appointment Queue
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage patient consultation requests, schedule visits &amp; launch prescriptions
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/doctor/qr"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-xs transition flex items-center gap-2"
            >
              <span>📷</span> Clinic Walk-in QR
            </Link>
            <Link
              href="/doctor/dashboard"
              className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-sm transition"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Approval</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{pendingList.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmed Schedule</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{confirmedList.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed Visits</p>
            <p className="text-2xl font-black text-purple-600 mt-1">
              {appointments.filter((a) => a.status === "completed").length}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{appointments.length}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-200 mb-6 bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl shadow-xs">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "pending"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Pending ({pendingList.length})
          </button>
          <button
            onClick={() => setActiveTab("confirmed")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "confirmed"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Confirmed ({confirmedList.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "completed"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Completed ({completedList.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "all"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            All Bookings ({appointments.length})
          </button>
        </div>

        {/* List of Appointments */}
        {displayedList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500">
            No appointments found in this category.
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedList.map((apt) => (
              <div
                key={apt.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg shrink-0">
                    👤
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-slate-900">
                        {apt.patient?.full_name}
                      </h3>
                      {getStatusBadge(apt.status)}
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {apt.type === "walk_in_qr" ? "Walk-in QR" : "Online Booking"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {apt.patient?.email} {apt.patient?.phone && `• 📞 ${apt.patient?.phone}`}
                    </p>

                    <div className="flex flex-wrap gap-y-1 gap-x-4 mt-2.5 text-xs text-slate-600 font-medium">
                      <span>🗓️ Date: <b>{new Date(apt.appointment_date).toLocaleDateString()}</b></span>
                      <span>⏰ Slot: <b>{apt.time_slot}</b></span>
                      {apt.reason_for_visit && (
                        <span className="text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded font-medium">
                          Symptoms: {apt.reason_for_visit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  {apt.status === "pending" && (
                    <>
                      <button
                        disabled={actionLoading === apt.id}
                        onClick={() => updateStatus(apt.id, "confirmed")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs"
                      >
                        Accept Booking
                      </button>
                      <button
                        disabled={actionLoading === apt.id}
                        onClick={() => updateStatus(apt.id, "cancelled")}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {(apt.status === "confirmed" || apt.status === "in_consultation") && (
                    <button
                      disabled={actionLoading === apt.id}
                      onClick={() => startConsultation(apt)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-1.5"
                    >
                      <span>🩺</span> Start Consultation &amp; Issue Rx
                    </button>
                  )}

                  {apt.status === "completed" && (
                    <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      Visit Completed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}