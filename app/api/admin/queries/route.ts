import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function checkAdminAuth(req: Request): boolean {
  const secret = req.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_SECRET;
  return Boolean(expected && secret === expected);
}

export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: queries, error } = await supabase
      .from("user_queries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json({ success: true, queries: queries || [] });
  } catch (error: any) {
    console.error("Admin queries GET error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, status, admin_response } = body;

    if (!id) {
      return Response.json({ success: false, message: "Query ID is required." }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_response !== undefined) updates.admin_response = admin_response;

    const { error } = await supabase
      .from("user_queries")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    return Response.json({
      success: true,
      message: "Query status updated successfully.",
    });
  } catch (error: any) {
    console.error("Admin queries PATCH error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
