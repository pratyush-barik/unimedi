import { verifyOTP } from "@/lib/otpStore";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, phone, otp, type, role } = await req.json();

    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();
    const cleanOtp = otp?.trim();

    if (!cleanEmail || !cleanOtp) {
      return Response.json({
        success: false,
        message: "Missing email or OTP",
      });
    }

    const valid = verifyOTP(cleanEmail, cleanOtp);

    if (!valid) {
      return Response.json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // =========================
    // SIGNUP FLOW
    // =========================
    if (type === "signup") {
      if (!cleanPhone) {
        return Response.json({
          success: false,
          message: "Phone required",
        });
      }

      // existing user by email
      let { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      // if exists, phone must match
      if (user && user.phone !== cleanPhone) {
        return Response.json({
          success: false,
          message: "Email linked with another phone",
        });
      }

      // if not exists, create identity
      if (!user) {
        const { data: newUser, error } = await supabase
          .from("users")
          .insert([
            {
              email: cleanEmail,
              phone: cleanPhone,
            },
          ])
          .select()
          .single();

        if (error) {
          return Response.json({
            success: false,
            message: error.message,
          });
        }

        user = newUser;
      }

      // add patient role if missing
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

      return Response.json({
        success: true,
        message: "Signup successful",
      });
    }

    // =========================
    // LOGIN FLOW
    // =========================
    if (type === "login") {
      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!user) {
        return Response.json({
          success: false,
          message: "Account not found",
        });
      }

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", role)
        .maybeSingle();

      if (!roleRow) {
        return Response.json({
          success: false,
          message: "Role not assigned",
        });
      }

      const cookieStore = await cookies();

      cookieStore.set("session", cleanEmail, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });

      return Response.json({
        success: true,
        user: {
          ...user,
          role: roleRow.role,
          speciality: roleRow.speciality || "",
        },
      });
    }

    return Response.json({
      success: false,
      message: "Invalid request type",
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      message: error.message || "Server error",
    });
  }
}