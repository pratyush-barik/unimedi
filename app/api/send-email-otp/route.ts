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
    const targetRole = role || "patient";

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

    // DOCTOR FLOW: Strict verification of pre-provisioned doctor accounts
    if (targetRole === "doctor") {
      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("id, email")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (userErr || !user) {
        return Response.json(
          {
            success: false,
            message: "Doctor account not found. Doctor accounts must be provisioned by a hospital administrator.",
          },
          { status: 404 }
        );
      }

      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", "doctor")
        .maybeSingle();

      if (roleErr || !roleRow) {
        return Response.json(
          {
            success: false,
            message: "Account is not registered with doctor privileges.",
          },
          { status: 403 }
        );
      }
    }

    // PATIENT SIGNUP FLOW: Conflict checks
    if (type === "signup" && targetRole === "patient") {
      if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
        return Response.json(
          {
            success: false,
            message: "Please provide a valid phone number.",
          },
          { status: 400 }
        );
      }

      if (cleanPhone) {
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
    }

    // Generate & send OTP
    const otp = generateOTP(cleanEmail);
    await sendOTP(cleanEmail, otp);

    return Response.json({
      success: true,
      message: `Verification code sent successfully to ${cleanEmail}.`,
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
