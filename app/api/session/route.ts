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

    // Fetch up-to-date user profile and role from Supabase
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", payload.userId)
      .maybeSingle();

    if (userError || !user) {
      return Response.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 }
      );
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", payload.userId)
      .eq("role", payload.role)
      .maybeSingle();

    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        date_of_birth: user.date_of_birth,
        gender: user.gender,
        blood_group: user.blood_group,
        address: user.address,
        role: payload.role,
        speciality: roleRow?.speciality || "",
        license_number: roleRow?.license_number || "",
        hospital_affiliation: roleRow?.hospital_affiliation || "",
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
