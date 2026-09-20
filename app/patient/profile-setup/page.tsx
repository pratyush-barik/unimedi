"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";

export default function ProfileSetupPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("Male");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    fetchCurrentSession().then(({ authenticated, user }) => {
      if (!authenticated || !user) {
        router.replace("/patient/signin");
        return;
      }

      setUserId(user.id);
      setFullName(user.full_name || "");
      if (user.date_of_birth) setDateOfBirth(user.date_of_birth);
      if (user.gender) setGender(user.gender);
      if (user.blood_group) setBloodGroup(user.blood_group);
      if (user.address) setAddress(user.address);

      setLoading(false);
    });
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          blood_group: bloodGroup || null,
          address: address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        setMessage({ text: error.message || "Failed to save profile.", type: "error" });
        setSaving(false);
        return;
      }

      router.replace("/patient/dashboard");
    } catch {
      setMessage({ text: "An error occurred while saving.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Loading health profile setup...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            🏥
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Complete Medical Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provide your clinical health details for accurate consultations
          </p>
        </div>

        {message && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold mb-6 border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other / Non-binary</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Blood Group *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setBloodGroup(bg)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    bloodGroup === bg
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Residential Address / Campus Hostels
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Block C, Room 402, Campus Residence"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !fullName}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-xs transition mt-2"
          >
            {saving ? "Saving Profile..." : "Save Profile & Enter Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}