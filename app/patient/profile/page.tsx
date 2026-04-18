"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileData = {
  full_name: string;
  email: string;
  phone: string;
  age: string;
  gender: string;
  blood_group: string;
};

export default function PatientProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = localStorage.getItem("session");

      if (!stored) {
        router.push("/patient/signin");
        return;
      }

      const session = JSON.parse(stored);

      const { data: user } = await supabase
        .from("users")
        .select("id, full_name, email, phone")
        .eq("email", session.email)
        .maybeSingle();

      if (!user) {
        router.push("/patient/signin");
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("age, gender, blood_group")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        age: profileRow?.age?.toString() || "",
        gender: profileRow?.gender || "",
        blood_group: profileRow?.blood_group || "",
      });

    } catch {
      router.push("/patient/dashboard");
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        Loading profile...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-indigo-600 mb-8">
          My Profile
        </h1>

        <div className="space-y-4">

          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Full Name</p>
            <p className="font-medium">{profile.full_name || "N/A"}</p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{profile.email}</p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Phone</p>
            <p className="font-medium">{profile.phone}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Age</p>
              <p className="font-medium">{profile.age || "N/A"}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Gender</p>
              <p className="font-medium">{profile.gender || "N/A"}</p>
            </div>

          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Blood Group</p>
            <p className="font-medium">{profile.blood_group || "N/A"}</p>
          </div>

        </div>

        <button
          onClick={() => router.push("/patient/dashboard")}
          className="w-full mt-8 bg-indigo-600 text-white py-3 rounded-lg"
        >
          Back to Dashboard
        </button>

      </div>

    </div>
  );
}