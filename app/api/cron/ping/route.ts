import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce token verification
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json(
        { success: false, message: "Unauthorized cron execution" },
        { status: 401 }
      );
    }

    // Ping Supabase to keep project warm and active
    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Cron keep-alive query error:", error);
      return Response.json(
        {
          success: false,
          message: "Supabase keep-alive check encountered an error",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "Supabase keep-alive ping successful",
      timestamp: new Date().toISOString(),
      userCount: count,
    });
  } catch (error: any) {
    console.error("Cron ping handler error:", error);
    return Response.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
