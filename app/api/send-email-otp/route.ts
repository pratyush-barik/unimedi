import { generateOTP } from "@/lib/otpStore";
import { sendOTP } from "@/lib/mailer";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, phone, type, role } = await req.json();

    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();

    if (!cleanEmail) {
      return Response.json({
        success: false,
        message: "Email is required",
      });
    }

    // LOGIN FLOW
    if (type === "login") {
      const { data: user } = await supabase
        .from("users")
        .select("id")
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
          message: "Role not assigned to this account",
        });
      }
    }

    // SIGNUP FLOW
    if (type === "signup") {
      if (!cleanPhone) {
        return Response.json({
          success: false,
          message: "Phone required",
        });
      }

      const { data: emailUser } = await supabase
        .from("users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (emailUser && emailUser.phone !== cleanPhone) {
        return Response.json({
          success: false,
          message: "Email linked with another phone",
        });
      }

      const { data: phoneUser } = await supabase
        .from("users")
        .select("*")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (phoneUser && phoneUser.email !== cleanEmail) {
        return Response.json({
          success: false,
          message: "Phone linked with another email",
        });
      }
    }

    const otp = generateOTP(cleanEmail);

    await sendOTP(cleanEmail, otp);

    return Response.json({
      success: true,
      message: "OTP sent",
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      message: error.message || "Failed",
    });
  }
}