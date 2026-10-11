import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return Response.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 }
      );
    }

    const payload = verifySessionToken(token);
    if (!payload || !payload.userId) {
      return Response.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 }
      );
    }

    // Fetch user profile from normalized profiles table
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", payload.userId)
      .maybeSingle();

    if (userError || !user) {
      return Response.json({
        authenticated: true,
        user: {
          id: payload.userId,
          email: payload.email,
          full_name: payload.fullName || "",
          role: payload.role,
          speciality: payload.speciality || "",
        },
      });
    }

    let patientData: any = null;
    let doctorData: any = null;
    let specialtyName = payload.speciality || "";

    if (payload.role === "patient") {
      const { data: pat } = await supabase
        .from("patients")
        .select("date_of_birth, gender, blood_group, address")
        .eq("id", user.id)
        .maybeSingle();
      patientData = pat;
    } else if (payload.role === "doctor") {
      const { data: doc } = await supabase
        .from("doctors")
        .select("license_number, hospital_affiliation, specialty_id")
        .eq("id", user.id)
        .maybeSingle();
      doctorData = doc;

      if (doc?.specialty_id) {
        const { data: spec } = await supabase
          .from("medical_specialties")
          .select("name")
          .eq("id", doc.specialty_id)
          .maybeSingle();
        if (spec?.name) specialtyName = spec.name;
      }
    }

    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        date_of_birth: patientData?.date_of_birth || null,
        gender: patientData?.gender || null,
        blood_group: patientData?.blood_group || null,
        address: patientData?.address || null,
        role: payload.role,
        speciality: specialtyName,
        license_number: doctorData?.license_number || "",
        hospital_affiliation: doctorData?.hospital_affiliation || "",
      },
    });
  } catch (error: any) {
    console.error("session route error:", error);
    return Response.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 500 }
    );
  }
}
