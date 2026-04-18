"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProfileSetupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage("");

      const stored = localStorage.getItem("session");

      if (!stored) {
        router.push("/patient/signin");
        return;
      }

      const session = JSON.parse(stored);

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      if (!user) {
        setMessage("User not found");
        setLoading(false);
        return;
      }

      // update users table full_name
      await supabase
        .from("users")
        .update({
          full_name: name,
        })
        .eq("id", user.id);

      // upsert profiles table
      await supabase
        .from("profiles")
        .upsert([
          {
            user_id: user.id,
            age: Number(age),
            gender,
            blood_group: bloodGroup,
          },
        ]);

      localStorage.setItem(
        "session",
        JSON.stringify({
          ...session,
          name,
        })
      );

      router.push("/patient/dashboard");

    } catch {
      setMessage("Failed to save profile");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center text-indigo-600 mb-2">
          Complete Profile
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Add your personal details
        </p>

        <div className="space-y-4">

          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            type="number"
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          >
            <option value="">Select Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>

          <select
            value={bloodGroup}
            onChange={(e) => setBloodGroup(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          >
            <option value="">Blood Group</option>
            <option>A+</option>
            <option>A-</option>
            <option>B+</option>
            <option>B-</option>
            <option>AB+</option>
            <option>AB-</option>
            <option>O+</option>
            <option>O-</option>
          </select>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg"
          >
            {loading ? "Saving..." : "Save Details"}
          </button>

        </div>

        {message && (
          <p className="text-center text-sm mt-6 text-gray-600">
            {message}
          </p>
        )}

      </div>

    </div>
  );
}