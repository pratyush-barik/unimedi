import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type QueryResult = {
  data: any;
  error: any;
  count?: number | null;
};

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tqciwohxbdsfbajwnnhh.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_dL6q8W5P_F1z5d2LvZ7GQg_RoFRHW7u";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2l3b2h4YmRzZmJhandubmhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUwODczNCwiZXhwIjoyMDkyMDg0NzM0fQ.Jvf1_rKtXfAJhzYIqOXL_Q9gwov4lPn7LrSXoHqcRVY";

// Server-side admin client (full DB access)
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Client-side / server-side universal query builder
class ClientQueryBuilder {
  private table: string;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private columns: string = "*";
  private filters: Array<{ type: string; column: string; value?: any; values?: any }> = [];
  private orderConfig?: { column: string; ascending?: boolean };
  private limitCount?: number;
  private payloadData?: any;
  private countOption?: string;
  private isHead?: boolean;
  private isSingle?: boolean;
  private isMaybeSingle?: boolean;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*", options?: { count?: string; head?: boolean }) {
    if (this.action !== "insert" && this.action !== "update") {
      this.action = "select";
    }
    this.columns = columns;
    if (options?.count) this.countOption = options.count;
    if (options?.head) this.isHead = true;
    return this;
  }

  insert(data: any) {
    this.action = "insert";
    this.payloadData = data;
    return this;
  }

  update(data: any) {
    this.action = "update";
    this.payloadData = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ type: "lt", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ type: "ilike", column, value });
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderConfig = { column, ascending };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single(): Promise<QueryResult> {
    this.isSingle = true;
    return this.execute();
  }

  async maybeSingle(): Promise<QueryResult> {
    this.isMaybeSingle = true;
    return this.execute();
  }

  private async execute(): Promise<QueryResult> {
    // If executing on the server, execute directly via supabaseAdmin for zero HTTP overhead
    if (typeof window === "undefined") {
      try {
        let q: any = supabaseAdmin.from(this.table);

        if (this.action === "select") {
          const selectOpts: any = {};
          if (this.countOption) selectOpts.count = this.countOption;
          if (this.isHead) selectOpts.head = true;
          q = q.select(this.columns, selectOpts);
        } else if (this.action === "insert") {
          q = q.insert(this.payloadData).select(this.columns);
        } else if (this.action === "update") {
          q = q.update(this.payloadData).select(this.columns);
        } else if (this.action === "delete") {
          q = q.delete();
        }

        for (const f of this.filters) {
          if (f.type === "eq") q = q.eq(f.column, f.value);
          else if (f.type === "neq") q = q.neq(f.column, f.value);
          else if (f.type === "in") q = q.in(f.column, f.values);
          else if (f.type === "gt") q = q.gt(f.column, f.value);
          else if (f.type === "lt") q = q.lt(f.column, f.value);
          else if (f.type === "gte") q = q.gte(f.column, f.value);
          else if (f.type === "lte") q = q.lte(f.column, f.value);
          else if (f.type === "ilike") q = q.ilike(f.column, f.value);
        }

        if (this.orderConfig) {
          q = q.order(this.orderConfig.column, { ascending: this.orderConfig.ascending ?? true });
        }

        if (typeof this.limitCount === "number") {
          q = q.limit(this.limitCount);
        }

        if (this.isSingle) q = q.single();
        else if (this.isMaybeSingle) q = q.maybeSingle();

        const res = await q;
        return { data: res.data, error: res.error, count: res.count };
      } catch (err: any) {
        return { data: null, error: { message: err?.message || "Database query error" } };
      }
    }

    // In the browser, send the query to /api/db which validates session and queries Supabase
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          columns: this.columns,
          filters: this.filters,
          order: this.orderConfig,
          limit: this.limitCount,
          data: this.payloadData,
          countOption: this.countOption,
          head: this.isHead,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        return {
          data: null,
          error: errorJson.error || { message: `HTTP ${res.status}: Failed to execute database query` },
          count: null,
        };
      }

      const json = await res.json();
      return { data: json.data, error: json.error, count: json.count };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || "Network error" }, count: null };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from(tableName: string) {
    return new ClientQueryBuilder(tableName);
  },
};
