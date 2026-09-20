import { generateOTP, checkOTPRateLimit } from "@/lib/otpStore";
import { sendOTP } from "@/lib/mailer";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[0-9+-\s()]{7,20}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phone, type, role } = body;

    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return Response.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    // Rate limit check
    const rateLimit = checkOTPRateLimit(cleanEmail);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          message: `Please wait ${rateLimit.waitSeconds}s before requesting another OTP.`,
        },
        { status: 429 }
      );
    }

    // LOGIN FLOW
    if (type === "login") {
      const targetRole = role || "patient";
      if (!["patient", "doctor", "admin"].includes(targetRole)) {
        return Response.json(
          {
            success: false,
            message: "Invalid role specified.",
          },
          { status: 400 }
        );
      }

      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("id, email")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (userErr || !user) {
        return Response.json(
          {
            success: false,
            message: "No account found with this email. Please sign up.",
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
    }

    // SIGNUP FLOW
    if (type === "signup") {
      if (!cleanPhone || !PHONE_REGEX.test(cleanPhone)) {
        return Response.json(
          {
            success: false,
            message: "A valid phone number is required.",
          },
          { status: 400 }
        );
      }

      const { data: emailUser } = await supabase
        .from("users")
        .select("id, phone")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (emailUser && emailUser.phone && emailUser.phone !== cleanPhone) {
        return Response.json(
          {
            success: false,
            message: "This email is already registered with a different phone number.",
          },
          { status: 409 }
        );
      }

      const { data: phoneUser } = await supabase
        .from("users")
        .select("id, email")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (phoneUser && phoneUser.email && phoneUser.email !== cleanEmail) {
        return Response.json(
          {
            success: false,
            message: "This phone number is already registered with a different email.",
          },
          { status: 409 }
        );
      }
    }

    const otp = generateOTP(cleanEmail);
    await sendOTP(cleanEmail, otp);

    return Response.json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}.`,
    });
  } catch (error: any) {
    console.error("send-email-otp error:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Failed to send OTP. Please try again.",
      },
      { status: 500 }
    );
  }
}