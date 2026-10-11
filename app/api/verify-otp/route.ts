import { verifyOTP } from "@/lib/otpStore";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { signSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phone, otp, role, fullName } = body;

    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();
    const cleanOtp = otp?.trim();
    const cleanFullName = fullName?.trim() || "";
    const targetRole = (role || "patient") as UserRole;

    if (!cleanEmail || !cleanOtp) {
      return Response.json(
        {
          success: false,
          message: "Email and OTP are required.",
        },
        { status: 400 }
      );
    }

    // 1. Verify OTP
    const verificationResult = verifyOTP(cleanEmail, cleanOtp);

    if (!verificationResult.success) {
      return Response.json(
        {
          success: false,
          message: verificationResult.reason || "Invalid or expired OTP.",
        },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();

    // =========================
    // =========================
    // DOCTOR AUTHENTICATION
    // =========================
    if (targetRole === "doctor") {
      const { data: user, error: userErr } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (userErr || !user) {
        return Response.json(
          {
            success: false,
            message: "Doctor account not found in system records.",
          },
          { status: 404 }
        );
      }

      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "doctor")
        .maybeSingle();

      if (roleErr || !roleRow) {
        return Response.json(
          {
            success: false,
            message: "Account does not have doctor credentials.",
          },
          { status: 403 }
        );
      }

      // Fetch doctor details from normalized doctors table
      const { data: doctorRow } = await supabase
        .from("doctors")
        .select("license_number, hospital_affiliation, specialty_id, qualification")
        .eq("id", user.id)
        .maybeSingle();

      let specialtyName = "General Physician";
      if (doctorRow?.specialty_id) {
        const { data: spec } = await supabase
          .from("medical_specialties")
          .select("name")
          .eq("id", doctorRow.specialty_id)
          .maybeSingle();
        if (spec?.name) specialtyName = spec.name;
      }

      // Generate signed session token
      const sessionToken = signSessionToken({
        userId: user.id,
        email: user.email,
        role: "doctor",
        fullName: user.full_name,
        speciality: specialtyName,
      });

      cookieStore.set(SESSION_COOKIE_OPTIONS.name, sessionToken, SESSION_COOKIE_OPTIONS);

      return Response.json({
        success: true,
        message: "Doctor authenticated successfully.",
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: "doctor" as UserRole,
          speciality: specialtyName,
          license_number: doctorRow?.license_number || "",
          hospital_affiliation: doctorRow?.hospital_affiliation || "UniMedi Clinic",
        },
      });
    }

    // =========================
    // PATIENT AUTHENTICATION
    // =========================
    if (targetRole === "patient") {
      // Find or create user in normalized profiles table
      let { data: user } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!user) {
        // Derive clean name if none provided
        const nameFromEmail = cleanEmail
          .split("@")[0]
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        const finalName = cleanFullName || nameFromEmail;

        const { data: newUser, error: createError } = await supabase
          .from("profiles")
          .insert([
            {
              email: cleanEmail,
              phone: cleanPhone || null,
              full_name: finalName,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (createError) {
          return Response.json(
            {
              success: false,
              message: createError.message || "Failed to create patient profile.",
            },
            { status: 500 }
          );
        }

        user = newUser;

        // Create corresponding row in patients table
        await supabase
          .from("patients")
          .insert([{ id: user.id }]);
      } else {
        // If user provided name or phone during signup, update if empty
        const updates: Record<string, any> = {};
        if (cleanFullName && (!user.full_name || user.full_name === user.email.split("@")[0])) {
          updates.full_name = cleanFullName;
        }
        if (cleanPhone && !user.phone) {
          updates.phone = cleanPhone;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("id", user.id);
          Object.assign(user, updates);
        }

        // Ensure patient table row exists
        const { data: patRow } = await supabase
          .from("patients")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!patRow) {
          await supabase.from("patients").insert([{ id: user.id }]);
        }
      }

      // Ensure patient role exists in user_roles
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "patient")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").insert([
          {
            user_id: user.id,
            role: "patient",
          },
        ]);
      }

      // Generate signed session token
      const sessionToken = signSessionToken({
        userId: user.id,
        email: user.email,
        role: "patient",
        fullName: user.full_name,
      });

      cookieStore.set(SESSION_COOKIE_OPTIONS.name, sessionToken, SESSION_COOKIE_OPTIONS);

      return Response.json({
        success: true,
        message: "Patient authenticated successfully.",
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          date_of_birth: user.date_of_birth,
          gender: user.gender,
          blood_group: user.blood_group,
          address: user.address,
          role: "patient" as UserRole,
        },
      });
    }

    return Response.json(
      {
        success: false,
        message: "Invalid role specified.",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("verify-otp error:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Authentication error occurred.",
      },
      { status: 500 }
    );
  }
}
