"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchCurrentSession, logoutUser } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";

type PendingRequest = {
  sessionId: string;
  doctorName: string;
  doctorSpeciality: string;
  doctorHospital: string;
  createdAt: string;
};

export default function PatientDashboard() {
  const router = useRouter();

  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("Patient");
  const [userEmail, setUserEmail] = useState<string>("");
  const [bloodGroup, setBloodGroup] = useState<string>("");

  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [prescriptionCount, setPrescriptionCount] = useState<number>(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeSessionDoctor, setActiveSessionDoctor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { authenticated, user } = await fetchCurrentSession();

      if (!authenticated || !user || user.role !== "patient") {
        router.replace("/patient/signin");
        return;
      }

      setUserId(user.id);
      setUserName(user.full_name || "Patient");
      setUserEmail(user.email);
      setBloodGroup(user.blood_group || "");

      // Load counts and sessions
      await Promise.all([
        loadStats(user.id),
        checkDoctorSessions(user.id),
      ]);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (pId: string) => {
    try {
      const { count: aptCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", pId)
        .in("status", ["pending", "confirmed", "in_consultation"]);
      setUpcomingCount(aptCount || 0);

      const { count: rxCount } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", pId);
      setPrescriptionCount(rxCount || 0);
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  };

  const checkDoctorSessions = async (pId: string) => {
    try {
      // 1. Check pending session requests (approved = false)
      const { data: pendingRows } = await supabase
        .from("doctor_sessions")
        .select("id, doctor_id, created_at, approved")
        .eq("patient_id", pId)
        .eq("approved", false);

      if (pendingRows && pendingRows.length > 0) {
        const enriched: PendingRequest[] = [];
        for (const row of pendingRows) {
          const { data: docUser } = await supabase
            .from("users")
            .select("full_name")
            .eq("id", row.doctor_id)
            .maybeSingle();

          const { data: docRole } = await supabase
            .from("user_roles")
            .select("speciality, hospital_affiliation")
            .eq("user_id", row.doctor_id)
            .eq("role", "doctor")
            .maybeSingle();

          enriched.push({
            sessionId: row.id,
            doctorName: docUser?.full_name || "Doctor",
            doctorSpeciality: docRole?.speciality || "General Physician",
            doctorHospital: docRole?.hospital_affiliation || "UniMedi Clinic",
            createdAt: row.created_at,
          });
        }
        setPendingRequests(enriched);
      } else {
        setPendingRequests([]);
      }

      // 2. Check active approved session
      const { data: activeRow } = await supabase
        .from("doctor_sessions")
        .select("doctor_id")
        .eq("patient_id", pId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeRow) {
        const { data: docUser } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", activeRow.doctor_id)
          .maybeSingle();
        setActiveSessionDoctor(docUser?.full_name || "Doctor");
      } else {
        setActiveSessionDoctor(null);
      }
    } catch (e) {
      console.error("Error checking sessions:", e);
    }
  };

  const handleApproveSession = async (sessionId: string) => {
    try {
      await supabase
        .from("doctor_sessions")
        .update({ approved: true })
        .eq("id", sessionId);

      if (userId) await checkDoctorSessions(userId);
    } catch (e) {
      console.error("Failed to approve session:", e);
    }
  };

  const handleDenySession = async (sessionId: string) => {
    try {
      await supabase.from("doctor_sessions").delete().eq("id", sessionId);
      if (userId) await checkDoctorSessions(userId);
    } catch (e) {
      console.error("Failed to deny session:", e);
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
          Loading patient dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-indigo-200">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Welcome, {userName}
                </h1>
                {bloodGroup && (
                  <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
                    {bloodGroup}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-400 font-mono mt-0.5">
                {userEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/patient/connect"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-xs transition flex items-center gap-2"
            >
              <span>📷</span> Scan Doctor QR
            </Link>
            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Real-time Consent Request Banner (If Doctor requested access) */}
        {pendingRequests.length > 0 && (
          <div className="space-y-3 mb-8">
            {pendingRequests.map((req) => (
              <div
                key={req.sessionId}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in slide-in-from-top duration-300"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-100">
                      Doctor Access Authorization Request
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">
                    Dr. {req.doctorName} ({req.doctorSpeciality})
                  </h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {req.doctorHospital} • Requested consultation access
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveSession(req.sessionId)}
                    className="bg-white hover:bg-amber-50 text-slate-900 font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition"
                  >
                    ✓ Approve Access
                  </button>
                  <button
                    onClick={() => handleDenySession(req.sessionId)}
                    className="bg-black/20 hover:bg-black/30 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live Active Consultation Indicator */}
        {activeSessionDoctor && pendingRequests.length === 0 && (
          <div className="bg-emerald-500 text-white p-5 rounded-3xl shadow-md mb-8 flex justify-between items-center animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-white animate-pulse"></span>
              <div>
                <p className="text-xs font-bold uppercase text-emerald-100">
                  Active Consultation In Progress
                </p>
                <p className="font-extrabold text-base">
                  Connected with Dr. {activeSessionDoctor}
                </p>
              </div>
            </div>
            <Link
              href="/patient/prescriptions"
              className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs px-4 py-2 rounded-xl transition"
            >
              View Prescriptions &rarr;
            </Link>
          </div>
        )}

        {/* Action Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Appointments */}
          <Link
            href="/patient/appointments"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl">
                  🗓️
                </div>
                {upcomingCount > 0 && (
                  <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {upcomingCount} Active
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Appointments
              </h2>
              <p className="text-sm text-slate-500">
                Book doctor slots, manage scheduled visits & walk-in check-in
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-indigo-600 flex items-center gap-1">
              Manage Bookings &rarr;
            </div>
          </Link>

          {/* Card 2: Prescriptions */}
          <Link
            href="/patient/prescriptions"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-serif font-black">
                  ℞
                </div>
                {prescriptionCount > 0 && (
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {prescriptionCount} Records
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Digital Prescriptions
              </h2>
              <p className="text-sm text-slate-500">
                Structured medicines, dosage directions & printable PDF slips
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-emerald-600 flex items-center gap-1">
              View Medications &rarr;
            </div>
          </Link>

          {/* Card 3: Connect Doctor (QR Walk-in) */}
          <Link
            href="/patient/connect"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-4">
                📲
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Connect Doctor QR
              </h2>
              <p className="text-sm text-slate-500">
                Scan clinic QR for instant walk-in doctor pairing with consent
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-purple-600 flex items-center gap-1">
              Open Camera Scanner &rarr;
            </div>
          </Link>

          {/* Card 4: Medical History */}
          <Link
            href="/patient/history"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-4">
                📂
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Medical History
              </h2>
              <p className="text-sm text-slate-500">
                Past clinical records, diagnoses, and consultation logs
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-blue-600 flex items-center gap-1">
              Review History &rarr;
            </div>
          </Link>

          {/* Card 5: Profile */}
          <Link
            href="/patient/profile"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4">
                👤
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                My Profile
              </h2>
              <p className="text-sm text-slate-500">
                Health details, blood group, emergency contact & address
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-amber-600 flex items-center gap-1">
              Edit Profile &rarr;
            </div>
          </Link>

          {/* Card 6: Help & Support */}
          <Link
            href="/patient/support"
            className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl mb-4">
                💬
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                Help &amp; Queries
              </h2>
              <p className="text-sm text-slate-500">
                Submit queries or support requests directly to the health team
              </p>
            </div>
            <div className="mt-6 text-sm font-bold text-teal-600 flex items-center gap-1">
              Contact Desk &rarr;
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}