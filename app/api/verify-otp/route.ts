import { verifyOTP } from "@/lib/otpStore";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { signSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phone, otp, type, role, fullName } = body;

    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();
    const cleanOtp = otp?.trim();
    const cleanFullName = fullName?.trim() || "";

    if (!cleanEmail || !cleanOtp) {
      return Response.json(
        {
          success: false,
          message: "Email and OTP are required.",
        },
        { status: 400 }
      );
    }

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
    // SIGNUP FLOW
    // =========================
    if (type === "signup") {
      if (!cleanPhone) {
        return Response.json(
          {
            success: false,
            message: "Phone number is required for registration.",
          },
          { status: 400 }
        );
      }

      // Check existing user by email
      let { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (user && user.phone && user.phone !== cleanPhone) {
        return Response.json(
          {
            success: false,
            message: "Email is already associated with another phone number.",
          },
          { status: 409 }
        );
      }

      // If user doesn't exist, create user record
      if (!user) {
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert([
            {
              email: cleanEmail,
              phone: cleanPhone,
              full_name: cleanFullName || cleanEmail.split("@")[0],
            },
          ])
          .select()
          .single();

        if (createError) {
          return Response.json(
            {
              success: false,
              message: createError.message || "Failed to create user account.",
            },
            { status: 500 }
          );
        }

        user = newUser;
      }

      // Ensure patient role exists for this user
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
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
        message: "Signup successful",
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: "patient" as UserRole,
        },
      });
    }

    // =========================
    // LOGIN FLOW
    // =========================
    if (type === "login") {
      const targetRole = (role || "patient") as UserRole;

      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (userErr || !user) {
        return Response.json(
          {
            success: false,
            message: "Account not found.",
          },
          { status: 404 }
        );
      }

      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", targetRole)
        .maybeSingle();

      if (roleErr || !roleRow) {
        return Response.json(
          {
            success: false,
            message: `Account is not registered as a ${targetRole}.`,
          },
          { status: 403 }
        );
      }

      // Sign session token
      const sessionToken = signSessionToken({
        userId: user.id,
        email: user.email,
        role: targetRole,
        fullName: user.full_name,
        speciality: roleRow.speciality || "",
      });

      cookieStore.set(SESSION_COOKIE_OPTIONS.name, sessionToken, SESSION_COOKIE_OPTIONS);

      return Response.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          date_of_birth: user.date_of_birth,
          gender: user.gender,
          blood_group: user.blood_group,
          address: user.address,
          role: roleRow.role as UserRole,
          speciality: roleRow.speciality || "",
          license_number: roleRow.license_number || "",
          hospital_affiliation: roleRow.hospital_affiliation || "",
        },
      });
    }

    return Response.json(
      {
        success: false,
        message: "Invalid request type.",
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