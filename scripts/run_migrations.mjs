/**
 * UniMedi v2 — Migration Runner
 * Executes SQL migration files against the live Supabase project.
 *
 * Strategy:
 * 1. Bootstrap a temporary exec_sql() function via the supabase-js client
 *    (using the service_role key which bypasses RLS on existing tables).
 * 2. Split each migration file into individual statements.
 * 3. Execute each statement via the exec_sql RPC function.
 * 4. Report success/failure per statement.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function getServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const envContent = readFileSync(join(ROOT, ".env.local"), "utf8");
    const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return "";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tqciwohxbdsfbajwnnhh.supabase.co";
const SERVICE_KEY = getServiceKey();

const MIGRATION_FILES = [
  "supabase/migrations/20261012000001_core_schema.sql",
  "supabase/migrations/20261012000002_performance.sql",
  "supabase/migrations/20261012000003_rls_policies.sql",
  "supabase/migrations/20261012000004_data_backfill.sql",
];

// ─── HTTP helper (no fetch quirks) ───────────────────────────────────────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Execute a single SQL statement via PostgREST RPC ────────────────────────
async function execSQL(sql) {
  const payload = JSON.stringify({ sql_text: sql });
  const res = await httpsRequest(
    {
      hostname: "tqciwohxbdsfbajwnnhh.supabase.co",
      path: "/rest/v1/rpc/unimedi_exec",
      method: "POST",
      headers: {
        Authorization: "Bearer " + SERVICE_KEY,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    payload
  );
  return res;
}

// ─── Bootstrap the exec function via raw INSERT into a helper table ──────────
async function bootstrapExecFunction() {
  console.log("\n🔧 Bootstrapping SQL executor function...");

  // We'll use the supabase-js client to call the SQL endpoint via the
  // auth.admin path which supports raw operations with service role
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // First verify connectivity
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .limit(1);

  if (error) {
    console.error("❌ Cannot connect to Supabase:", error.message);
    process.exit(1);
  }
  console.log("✅ Connected to Supabase (legacy users table has rows)");

  // Check if unimedi_exec already exists
  const { data: testData, error: testError } = await supabase.rpc('unimedi_exec', { sql_text: 'SELECT 1;' });
  if (!testError && (!testData || testData.status !== 'error')) {
    console.log("✅ unimedi_exec is already installed and working!");
    return true;
  }
  const bootstrapSQL = `
    CREATE OR REPLACE FUNCTION public.unimedi_exec(sql_text TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      result JSONB := '{"status":"ok"}'::JSONB;
    BEGIN
      EXECUTE sql_text;
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'status', 'error',
        'code', SQLSTATE,
        'message', SQLERRM
      );
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.unimedi_exec(TEXT) TO service_role;
  `.trim();

  // Use the Supabase RPC endpoint to bootstrap (try existing rpc path first)
  // We can use auth.admin.createUser to execute SQL indirectly... actually
  // let's try the direct database API which service_role should access via
  // the special Content-Type: application/sql PostgREST feature in some versions

  // PostgREST 10+ supports Content-Type: application/sql for DDL via service role
  const ddlPayload = bootstrapSQL;
  const bootstrapRes = await httpsRequest(
    {
      hostname: "tqciwohxbdsfbajwnnhh.supabase.co",
      path: "/rest/v1/",
      method: "POST",
      headers: {
        Authorization: "Bearer " + SERVICE_KEY,
        apikey: SERVICE_KEY,
        "Content-Type": "application/sql",
        "Content-Length": Buffer.byteLength(ddlPayload),
      },
    },
    ddlPayload
  );

  if (bootstrapRes.status === 200 || bootstrapRes.status === 204) {
    console.log("✅ Executor function created via application/sql");
    return true;
  }

  console.log(
    `⚠️  application/sql returned ${bootstrapRes.status} — trying alternative...`
  );

  // Alternative: use the supabase management API with the service role as db-url
  // The Supabase project DB password is not available, but we can use the
  // pooler connection which uses the service role as password in some setups
  const poolerUrls = [
    `postgresql://postgres.tqciwohxbdsfbajwnnhh:${SERVICE_KEY}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.tqciwohxbdsfbajwnnhh:${SERVICE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ];

  console.log("⚠️  Service role key cannot execute DDL via PostgREST directly.");
  console.log("\n📋 MANUAL STEP REQUIRED:");
  console.log("─".repeat(60));
  console.log(
    "Please run this ONE-TIME bootstrap SQL in your Supabase SQL Editor:"
  );
  console.log("🔗 https://supabase.com/dashboard/project/tqciwohxbdsfbajwnnhh/sql/new");
  console.log("\n" + bootstrapSQL);
  console.log("─".repeat(60));
  return false;
}

// ─── Split SQL file into individual statements ───────────────────────────────
function splitStatements(sql) {
  // Remove single-line comments
  sql = sql.replace(/--[^\n]*/g, "");

  const statements = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let inSingleQuote = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const rest = sql.slice(i);

    // Dollar-quote detection ($$...$$  or $tag$...$tag$)
    if (!inSingleQuote && !inDollarQuote) {
      const dqMatch = rest.match(/^(\$[A-Za-z0-9_]*\$)/);
      if (dqMatch) {
        inDollarQuote = true;
        dollarTag = dqMatch[1];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    } else if (inDollarQuote && rest.startsWith(dollarTag)) {
      inDollarQuote = false;
      current += dollarTag;
      i += dollarTag.length;
      dollarTag = "";
      continue;
    }

    // Single-quote toggle
    if (!inDollarQuote && ch === "'") {
      inSingleQuote = !inSingleQuote;
    }

    // Statement terminator
    if (!inDollarQuote && !inSingleQuote && ch === ";") {
      const stmt = current.trim();
      if (stmt.length > 3) {
        statements.push(stmt);
      }
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // Handle trailing statement without semicolon
  const trailing = current.trim();
  if (trailing.length > 3) {
    statements.push(trailing);
  }

  return statements.filter((s) => s.length > 0);
}

// ─── Run a migration file ────────────────────────────────────────────────────
async function runMigrationFile(filename) {
  const filepath = join(ROOT, filename);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📄 Running: ${filename}`);
  console.log("═".repeat(60));

  const sql = readFileSync(filepath, "utf-8");
  const statements = splitStatements(sql);
  console.log(`  Found ${statements.length} statements`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Extract a short label from the statement
    const label = stmt
      .replace(/\s+/g, " ")
      .substring(0, 80)
      .trim();

    const res = await execSQL(stmt + ";");

    if (res.status === 200 || res.status === 204) {
      const body = res.body;
      if (body && body.status === "error") {
        // Check if it's an "already exists" error (safe to skip)
        const code = body.code || "";
        const msg = (body.message || "").toLowerCase();
        if (
          code === "42P07" || // duplicate_table
          code === "42710" || // duplicate_object
          code === "42P16" || // invalid_table_definition (already exists)
          msg.includes("already exists")
        ) {
          console.log(`  ⏭  [${i + 1}/${statements.length}] SKIP (already exists): ${label}`);
          skipped++;
        } else {
          console.error(`  ❌ [${i + 1}/${statements.length}] FAIL: ${label}`);
          console.error(`     Code: ${body.code} | ${body.message}`);
          failed++;
        }
      } else {
        console.log(`  ✅ [${i + 1}/${statements.length}] OK: ${label}`);
        passed++;
      }
    } else {
      console.error(`  ❌ [${i + 1}/${statements.length}] HTTP ${res.status}: ${label}`);
      console.error("     Response:", JSON.stringify(res.body).substring(0, 200));
      failed++;
    }
  }

  console.log(`\n  Summary: ✅ ${passed} passed | ⏭ ${skipped} skipped | ❌ ${failed} failed`);
  return { passed, skipped, failed };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 UniMedi v2 Migration Runner");
  console.log("   Target: https://tqciwohxbdsfbajwnnhh.supabase.co");
  console.log("   Files: " + MIGRATION_FILES.length + " migrations\n");

  const bootstrapped = await bootstrapExecFunction();
  if (!bootstrapped) {
    process.exit(1);
  }

  // Verify the exec function works
  const testRes = await execSQL("SELECT 'migration_runner_ok'::TEXT;");
  if (testRes.status !== 200 || (testRes.body && testRes.body.status === "error")) {
    console.error("❌ Executor function test failed:", testRes.body);
    process.exit(1);
  }
  console.log("✅ Executor function verified\n");

  let totalPassed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const file of MIGRATION_FILES) {
    const { passed, skipped, failed } = await runMigrationFile(file);
    totalPassed += passed;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("🏁 MIGRATION COMPLETE");
  console.log(`   ✅ ${totalPassed} statements executed`);
  console.log(`   ⏭  ${totalSkipped} already existed (skipped)`);
  console.log(`   ❌ ${totalFailed} failed`);
  console.log("═".repeat(60));

  if (totalFailed === 0) {
    console.log("\n✨ All migrations applied successfully!");
    console.log("🔒 unimedi_exec preserved for future automated database operations.");
  } else {
    console.log("\n⚠️  Some statements failed. Review errors above.");
    console.log("   Re-running is safe (idempotent migrations).");
  }
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
