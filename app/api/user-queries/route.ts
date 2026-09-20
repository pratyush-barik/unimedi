import { supabase } from "@/lib/supabase";
import { getSessionFromServer } from "@/lib/session";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(req: Request) {
  try {
    const session = await getSessionFromServer();
    const body = await req.json();
    const { name, email, role, subject, message } = body;

    const cleanName = name?.trim();
    const cleanEmail = (email || session?.email)?.trim().toLowerCase();
    const cleanSubject = subject?.trim();
    const cleanMessage = message?.trim();
    const userRole = role || session?.role || "patient";

    if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
      return Response.json(
        { success: false, message: "Please fill in all required fields." },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return Response.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_queries")
      .insert([
        {
          user_id: session?.userId || null,
          name: cleanName,
          email: cleanEmail,
          role: userRole,
          subject: cleanSubject,
          message: cleanMessage,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return Response.json({
      success: true,
      message: "Your message has been submitted. Our team will review it shortly.",
      query: data,
    });
  } catch (error: any) {
    console.error("user-queries POST error:", error);
    return Response.json(
      { success: false, message: error.message || "Failed to submit query." },
      { status: 500 }
    );
  }
}
