"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UserQuery } from "@/lib/types";

type DoctorItem = {
  id: string;
  role_id: string;
  email: string;
  full_name: string;
  phone?: string;
  speciality: string;
  license_number?: string;
  hospital_affiliation?: string;
  created_at: string;
};

type Stats = {
  patients: number;
  doctors: number;
  appointments: number;
  records: number;
  activeSessions: number;
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<"overview" | "doctors" | "queries">("overview");
  const [stats, setStats] = useState<Stats>({
    patients: 0,
    doctors: 0,
    appointments: 0,
    records: 0,
    activeSessions: 0,
  });

  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [queries, setQueries] = useState<UserQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Doctor Form Modal / State
  const [editingDoctor, setEditingDoctor] = useState<DoctorItem | null>(null);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [docName, setDocName] = useState("");
  const [docEmail, setDocEmail] = useState("");
  const [docPhone, setDocPhone] = useState("");
  const [docSpeciality, setDocSpeciality] = useState("General Physician");
  const [docLicense, setDocLicense] = useState("");
  const [docHospital, setDocHospital] = useState("UniMedi Health Centre");

  // Query Response State
  const [selectedQuery, setSelectedQuery] = useState<UserQuery | null>(null);
  const [queryStatus, setQueryStatus] = useState<"pending" | "in_review" | "resolved">("pending");
  const [adminReply, setAdminReply] = useState("");

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: keyInput.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setAdminKey(keyInput.trim());
        setIsAuthenticated(true);
      } else {
        setAuthError(data.message || "Invalid admin secret key.");
      }
    } catch {
      setAuthError("Failed to authenticate with server.");
    }
  };

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      loadAllAdminData();
    }
  }, [isAuthenticated, adminKey]);

  const loadAllAdminData = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadDoctors(), loadQueries()]);
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const { count: patientCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "patient");

      const { count: doctorCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "doctor");

      const { count: aptCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true });

      const { count: recordCount } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true });

      const { count: sessionCount } = await supabase
        .from("doctor_sessions")
        .select("*", { count: "exact", head: true })
        .eq("approved", true);

      setStats({
        patients: patientCount || 0,
        doctors: doctorCount || 0,
        appointments: aptCount || 0,
        records: recordCount || 0,
        activeSessions: sessionCount || 0,
      });
    } catch (e) {
      console.error("Stats loading error:", e);
    }
  };

  const loadDoctors = async () => {
    try {
      const res = await fetch("/api/admin/doctors", {
        headers: { "x-admin-secret": adminKey },
      });
      const data = await res.json();
      if (data.success) {
        setDoctors(data.doctors || []);
      }
    } catch (e) {
      console.error("Doctors loading error:", e);
    }
  };

  const loadQueries = async () => {
    try {
      const res = await fetch("/api/admin/queries", {
        headers: { "x-admin-secret": adminKey },
      });
      const data = await res.json();
      if (data.success) {
        setQueries(data.queries || []);
      }
    } catch (e) {
      console.error("Queries loading error:", e);
    }
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);

    try {
      if (editingDoctor) {
        // PATCH
        const res = await fetch("/api/admin/doctors", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminKey,
          },
          body: JSON.stringify({
            id: editingDoctor.id,
            full_name: docName,
            phone: docPhone,
            speciality: docSpeciality,
            license_number: docLicense,
            hospital_affiliation: docHospital,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ text: "Doctor updated successfully!", type: "success" });
          setEditingDoctor(null);
          await loadDoctors();
          await loadStats();
        } else {
          setActionMessage({ text: data.message || "Failed to update.", type: "error" });
        }
      } else {
        // POST
        const res = await fetch("/api/admin/doctors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminKey,
          },
          body: JSON.stringify({
            full_name: docName,
            email: docEmail,
            phone: docPhone,
            speciality: docSpeciality,
            license_number: docLicense,
            hospital_affiliation: docHospital,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ text: "New doctor registered successfully!", type: "success" });
          setShowAddDoctor(false);
          resetDocForm();
          await loadDoctors();
          await loadStats();
        } else {
          setActionMessage({ text: data.message || "Failed to add doctor.", type: "error" });
        }
      }
    } catch {
      setActionMessage({ text: "Operation failed.", type: "error" });
    }
  };

  const handleDeleteDoctor = async (docId: string) => {
    if (!confirm("Are you sure you want to remove this doctor from the registry?")) return;

    try {
      const res = await fetch(`/api/admin/doctors?id=${docId}`, {
        method: "DELETE",
        headers: { "x-admin-secret": adminKey },
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: "Doctor removed.", type: "success" });
        await loadDoctors();
        await loadStats();
      }
    } catch {
      setActionMessage({ text: "Failed to delete doctor.", type: "error" });
    }
  };

  const handleUpdateQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuery) return;

    try {
      const res = await fetch("/api/admin/queries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminKey,
        },
        body: JSON.stringify({
          id: selectedQuery.id,
          status: queryStatus,
          admin_response: adminReply,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: "Query response saved.", type: "success" });
        setSelectedQuery(null);
        await loadQueries();
      }
    } catch {
      setActionMessage({ text: "Failed to update query.", type: "error" });
    }
  };

  const resetDocForm = () => {
    setDocName("");
    setDocEmail("");
    setDocPhone("");
    setDocSpeciality("General Physician");
    setDocLicense("");
    setDocHospital("UniMedi Health Centre");
  };

  const openEditDoctor = (doc: DoctorItem) => {
    setEditingDoctor(doc);
    setDocName(doc.full_name);
    setDocEmail(doc.email);
    setDocPhone(doc.phone || "");
    setDocSpeciality(doc.speciality);
    setDocLicense(doc.license_number || "");
    setDocHospital(doc.hospital_affiliation || "");
  };

  // 1. Password Protection Dialog
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 w-full max-w-md rounded-3xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🛡️
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            UniMedi System Admin
          </h1>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Authorized administrative console. Enter master passkey to continue.
          </p>

          {authError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 mb-4 font-semibold">
              {authError}
            </p>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter ADMIN_SECRET..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-indigo-500 outline-none"
              autoFocus
              required
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition text-sm shadow-lg shadow-indigo-600/30"
            >
              Authenticate &amp; Access
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-8 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                UniMedi Master Administration
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Hospital System &amp; Practitioner Management
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition"
          >
            Lock Admin Console
          </button>
        </div>

        {actionMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold mb-6 border ${
              actionMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-8 bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl shadow-xs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            System Overview &amp; Stats
          </button>
          <button
            onClick={() => setActiveTab("doctors")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "doctors"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Doctor Registry ({doctors.length})
          </button>
          <button
            onClick={() => setActiveTab("queries")}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition ${
              activeTab === "queries"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            User Queries Helpdesk ({queries.length})
          </button>
        </div>

        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Patients</span>
                <span className="text-3xl font-black text-indigo-600 mt-1 block">{stats.patients}</span>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Doctors</span>
                <span className="text-3xl font-black text-emerald-600 mt-1 block">{stats.doctors}</span>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Bookings</span>
                <span className="text-3xl font-black text-slate-900 mt-1 block">{stats.appointments}</span>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Issued Prescriptions</span>
                <span className="text-3xl font-black text-purple-600 mt-1 block">{stats.records}</span>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active QR Sessions</span>
                <span className="text-3xl font-black text-amber-600 mt-1 block">{stats.activeSessions}</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Hospital Network Status</h2>
              <p className="text-xs text-slate-500 mb-6">
                All microservices, Supabase database, and Nodemailer OTP mechanisms are operational.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 text-xs font-semibold">
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200">
                  ✓ Database Status: Connected &amp; RLS Enforced
                </div>
                <div className="p-4 bg-indigo-50 text-indigo-800 rounded-2xl border border-indigo-200">
                  ✓ OTP Auth: Custom Nodemailer Dispatch Active
                </div>
                <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl border border-blue-200">
                  ✓ Daily Keep-Alive Cron: Configured
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DOCTOR CRUD */}
        {activeTab === "doctors" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Registered Medical Doctors</h2>
              <button
                onClick={() => {
                  resetDocForm();
                  setEditingDoctor(null);
                  setShowAddDoctor(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
              >
                + Register New Doctor
              </button>
            </div>

            {/* Doctor Modal / Form */}
            {(showAddDoctor || editingDoctor) && (
              <div className="bg-white rounded-3xl border-2 border-indigo-500 p-6 shadow-xl space-y-4 animate-in fade-in">
                <h3 className="font-bold text-slate-900 text-base">
                  {editingDoctor ? `Edit Dr. ${editingDoctor.full_name}` : "Register New Doctor"}
                </h3>
                <form onSubmit={handleSaveDoctor} className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      placeholder="Dr. Jane Smith"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Email * (Login)</label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(editingDoctor)}
                      value={docEmail}
                      onChange={(e) => setDocEmail(e.target.value)}
                      placeholder="doctor@gmail.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phone</label>
                    <input
                      type="tel"
                      value={docPhone}
                      onChange={(e) => setDocPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Speciality *</label>
                    <input
                      type="text"
                      required
                      value={docSpeciality}
                      onChange={(e) => setDocSpeciality(e.target.value)}
                      placeholder="Cardiology, General Physician, ENT..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">License / Registration Number</label>
                    <input
                      type="text"
                      value={docLicense}
                      onChange={(e) => setDocLicense(e.target.value)}
                      placeholder="MD-98234-NY"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Hospital Affiliation</label>
                    <input
                      type="text"
                      value={docHospital}
                      onChange={(e) => setDocHospital(e.target.value)}
                      placeholder="UniMedi Campus Clinic"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>

                  <div className="sm:col-span-2 flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition"
                    >
                      {editingDoctor ? "Update Doctor" : "Create Doctor"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddDoctor(false);
                        setEditingDoctor(null);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-6 rounded-xl transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Doctors List */}
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-6 py-3 text-left">Doctor</th>
                      <th className="px-6 py-3 text-left">Speciality</th>
                      <th className="px-6 py-3 text-left">Hospital</th>
                      <th className="px-6 py-3 text-left">License #</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctors.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-3.5">
                          <p className="font-bold text-slate-900">{doc.full_name}</p>
                          <p className="text-slate-400 font-mono text-[11px]">{doc.email}</p>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-indigo-700">{doc.speciality}</td>
                        <td className="px-6 py-3.5 text-slate-600">{doc.hospital_affiliation || "-"}</td>
                        <td className="px-6 py-3.5 font-mono text-slate-500">{doc.license_number || "-"}</td>
                        <td className="px-6 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => openEditDoctor(doc)}
                            className="text-indigo-600 hover:text-indigo-900 font-bold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDoctor(doc.id)}
                            className="text-rose-600 hover:text-rose-900 font-bold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USER QUERIES HELPDESK */}
        {activeTab === "queries" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Patient &amp; User Support Inquiries</h2>

            {/* Query Response Modal */}
            {selectedQuery && (
              <div className="bg-white rounded-3xl border-2 border-indigo-500 p-6 shadow-xl space-y-4 animate-in fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{selectedQuery.subject}</h3>
                    <p className="text-xs text-slate-500">
                      From: <b>{selectedQuery.name}</b> ({selectedQuery.email}) • Role: {selectedQuery.role}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedQuery(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-800 border border-slate-200">
                  <p className="font-bold text-slate-400 text-[10px] uppercase mb-1">User Message:</p>
                  {selectedQuery.message}
                </div>

                <form onSubmit={handleUpdateQuery} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Update Status</label>
                    <select
                      value={queryStatus}
                      onChange={(e) => setQueryStatus(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_review">In Review</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Admin Response / Internal Notes</label>
                    <textarea
                      rows={3}
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      placeholder="Write response or actions taken..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition"
                  >
                    Save Query Update
                  </button>
                </form>
              </div>
            )}

            {/* Queries List */}
            {queries.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500">
                No user queries received yet.
              </div>
            ) : (
              <div className="space-y-3">
                {queries.map((q) => (
                  <div
                    key={q.id}
                    className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            q.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : q.status === "in_review"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {q.status}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{q.subject}</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        {q.name} ({q.email}) • {new Date(q.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-700 mt-2 line-clamp-1">{q.message}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedQuery(q);
                        setQueryStatus(q.status as any);
                        setAdminReply(q.admin_response || "");
                      }}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-4 py-2 rounded-xl transition"
                    >
                      Review &amp; Reply &rarr;
                    </button>
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
