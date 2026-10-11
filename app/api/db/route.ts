import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tqciwohxbdsfbajwnnhh.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2l3b2h4YmRzZmJhandubmhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUwODczNCwiZXhwIjoyMDkyMDg0NzM0fQ.Jvf1_rKtXfAJhzYIqOXL_Q9gwov4lPn7LrSXoHqcRVY";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    const session = token ? verifySessionToken(token) : null;

    const body = await req.json();
    const {
      table,
      action = "select",
      columns = "*",
      filters = [],
      order,
      limit,
      data,
      countOption,
    } = body;

    if (!table) {
      return Response.json({ data: null, error: { message: "Table is required" } }, { status: 400 });
    }

    let query: any = supabaseAdmin.from(table);

    // Apply action
    if (action === "select") {
      const selectOpts: any = {};
      if (countOption) {
        selectOpts.count = countOption;
        if (body.head) selectOpts.head = true;
      }
      query = query.select(columns, selectOpts);
    } else if (action === "insert") {
      query = query.insert(data).select(columns);
    } else if (action === "update") {
      query = query.update(data).select(columns);
    } else if (action === "delete") {
      query = query.delete();
    }

    // Apply filters
    for (const f of filters) {
      if (f.type === "eq") {
        query = query.eq(f.column, f.value);
      } else if (f.type === "neq") {
        query = query.neq(f.column, f.value);
      } else if (f.type === "in") {
        query = query.in(f.column, f.values);
      } else if (f.type === "gt") {
        query = query.gt(f.column, f.value);
      } else if (f.type === "lt") {
        query = query.lt(f.column, f.value);
      } else if (f.type === "gte") {
        query = query.gte(f.column, f.value);
      } else if (f.type === "lte") {
        query = query.lte(f.column, f.value);
      } else if (f.type === "ilike") {
        query = query.ilike(f.column, f.value);
      }
    }

    // Apply order
    if (order && order.column) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    // Apply limit
    if (limit && typeof limit === "number") {
      query = query.limit(limit);
    }

    // Apply single / maybeSingle
    if (body.single) {
      query = query.single();
    } else if (body.maybeSingle) {
      query = query.maybeSingle();
    }

    const result = await query;
    return Response.json({
      data: result.data,
      error: result.error,
      count: result.count,
    });
  } catch (err: any) {
    return Response.json(
      { data: null, error: { message: err?.message || "Internal database error" } },
      { status: 500 }
    );
  }
}
