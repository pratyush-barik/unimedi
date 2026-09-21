"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession, logoutUser, AuthUser } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [treatedCount, setTreatedCount] = useState(0);

  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    patientId: string;
    patientName: string;
    patientEmail: string;
    patientPhone?: string;
    approved: boolean;
  } | null>(null);

  useEffect(() => {
    fetchCurrentSession().then(({ authenticated, user }) => {
      if (!authenticated || user?.role !== "doctor") {
        router.replace("/doctor/login");
      } else {
        setDoctor(user);
        loadDashboardData(user.id);
        checkActiveSession(user.id);
      }
      setLoading(false);
    });

    const interval = setInterval(() => {
      if (doctor?.id) {
        checkActiveSession(doctor.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router, doctor?.id]);

  const loadDashboardData = async (doctorId: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Appointments count
      const { data: todayApts } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", today);

      setTodayCount(todayApts?.length || 0);

      // Pending requests count
      const { data: pendingApts } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("status", "pending");

      setPendingCount(pendingApts?.length || 0);

      // Treated records count
      const { data: records } = await supabase
        .from("medical_records")
        .select("id")
        .eq("doctor_id", doctorId);

      setTreatedCount(records?.length || 0);
    } catch (e) {
      console.error("Dashboard count error:", e);
    }
  };

  const checkActiveSession = async (doctorId: string) => {
    try {
      const { data: sessions } = await supabase
        .from("doctor_sessions")
        .select("*")
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!sessions || sessions.length === 0) {
        setActiveSession(null);
        return;
      }

      const latest = sessions[0];
      const { data: patient } = await supabase
        .from("users")
        .select("id, full_name, email, phone")
        .eq("id", latest.patient_id)
        .maybeSingle();

      if (patient) {
        setActiveSession({
          sessionId: latest.id,
          patientId: patient.id,
          patientName: patient.full_name || "Patient",
          patientEmail: patient.email,
          patientPhone: patient.phone || undefined,
          approved: latest.approved,
        });
      }
    } catch (e) {
      console.error("Error checking active session:", e);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Loading clinical dashboard...
        </div>
      </div>
    );
  }

  if (!doctor) return null;

  const displayName = doctor.full_name?.startsWith("Dr. ")
    ? doctor.full_name
    : `Dr. ${doctor.full_name || "Doctor"}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Doctor Header Banner */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-indigo-200">
              🩺
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {displayName}
                </h1>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {doctor.speciality || "General Physician"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {doctor.email} &bull; {doctor.hospital_affiliation || "University Central Medical Centre"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/doctor/qr"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-xs transition flex items-center gap-2"
            >
              <span>📱</span> Show Clinic QR
            </Link>
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Live In-Clinic Patient Connected Banner */}
        {activeSession && (
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 rounded-3xl shadow-lg mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-300">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  Active In-Clinic Patient Connected (Consent Approved)
                </span>
              </div>
              <h2 className="text-xl font-extrabold">
                {activeSession.patientName}
              </h2>
              <p className="text-xs text-indigo-100 font-mono mt-0.5">
                {activeSession.patientEmail} {activeSession.patientPhone && `&bull; ${activeSession.patientPhone}`}
              </p>
            </div>

            <Link
              href={`/doctor/patient?patientId=${activeSession.patientId}`}
              className="bg-white hover:bg-indigo-50 text-indigo-700 font-bold px-6 py-3 rounded-xl shadow-md transition text-sm flex items-center gap-2"
            >
              <span>👨‍⚕️</span> Open Consultation &amp; Rx Builder
            </Link>
          </div>
        )}

        {/* Action Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Appointments Console */}
          <Link
            href="/doctor/appointments"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl">
                  📅
                </div>
                {pendingCount > 0 ? (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs animate-pulse">
                    {pendingCount} Pending
                  </span>
                ) : (
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200">
                    {todayCount} Today
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Appointments Console
              </h2>
              <p className="text-sm text-slate-500">
                Review booking requests, manage confirmed schedule &amp; launch consultations
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-indigo-600 flex items-center gap-1">
              Open Appointments &rarr;
            </div>
          </Link>

          {/* Card 2: Clinic QR Code */}
          <Link
            href="/doctor/qr"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl mb-4">
                📱
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Clinic QR Code
              </h2>
              <p className="text-sm text-slate-500">
                Display walk-in QR for instant in-clinic patient pairing and queue
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-orange-600 flex items-center gap-1">
              Display QR &rarr;
            </div>
          </Link>

          {/* Card 3: Treated Patients & History */}
          <Link
            href="/doctor/patients"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
                  👥
                </div>
                {treatedCount > 0 && (
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {treatedCount} Consultations
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Treated Patients
              </h2>
              <p className="text-sm text-slate-500">
                Review past patient consultations, prescribed medications &amp; clinical history
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-emerald-600 flex items-center gap-1">
              View Treated Records &rarr;
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
