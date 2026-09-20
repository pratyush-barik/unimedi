"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";

type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  address: string;
};

export default function PatientProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Edit fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { authenticated, user } = await fetchCurrentSession();

      if (!authenticated || !user) {
        router.replace("/patient/signin");
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (userRow) {
        setProfile({
          id: userRow.id,
          full_name: userRow.full_name || "",
          email: userRow.email || "",
          phone: userRow.phone || "",
          date_of_birth: userRow.date_of_birth || "",
          gender: userRow.gender || "Not specified",
          blood_group: userRow.blood_group || "Not specified",
          address: userRow.address || "Not specified",
        });

        setFullName(userRow.full_name || "");
        setPhone(userRow.phone || "");
        setDateOfBirth(userRow.date_of_birth || "");
        setGender(userRow.gender || "Male");
        setBloodGroup(userRow.blood_group || "O+");
        setAddress(userRow.address || "");
      }
    } catch {
      router.replace("/patient/signin");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          date_of_birth: dateOfBirth || null,
          gender,
          blood_group: bloodGroup,
          address: address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        setMessage({ text: error.message || "Failed to update profile.", type: "error" });
        setSaving(false);
        return;
      }

      setMessage({ text: "Profile updated successfully!", type: "success" });
      setIsEditing(false);
      await loadProfile();
    } catch {
      setMessage({ text: "Failed to update profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 font-semibold animate-pulse text-sm">
          Loading patient profile...
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Personal Health Profile
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your personal and clinical emergency information
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-white hover:bg-slate-50 text-indigo-600 font-bold px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs text-sm transition"
            >
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>
            <Link
              href="/patient/dashboard"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs text-sm transition"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold mb-6 border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {!isEditing ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-6">
            {/* Top Identity */}
            <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-indigo-200">
                {profile.full_name.charAt(0).toUpperCase() || "P"}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {profile.full_name || "Patient"}
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {profile.email} • {profile.phone || "No phone linked"}
                </p>
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Blood Group
                </span>
                <span className="text-lg font-black text-rose-600">
                  {profile.blood_group}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Gender
                </span>
                <span className="text-base font-bold text-slate-800">
                  {profile.gender}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Date of Birth
                </span>
                <span className="text-base font-bold text-slate-800">
                  {profile.date_of_birth
                    ? new Date(profile.date_of_birth).toLocaleDateString()
                    : "Not specified"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Contact Phone
                </span>
                <span className="text-base font-bold text-slate-800">
                  {profile.phone || "N/A"}
                </span>
              </div>

              <div className="sm:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Address / Residence
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {profile.address || "Not provided"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleUpdate}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-5"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Blood Group
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Address / Campus Residence
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition shadow-xs"
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}