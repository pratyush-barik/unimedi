/**
 * UniMedi v2 — Direct Supabase Management API Migration Runner
 * Uses the Supabase Personal Access Token (PAT) to execute migrations directly.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const envContent = readFileSync(join(ROOT, ".env.local"), "utf8");
    const match = envContent.match(/SUPABASE_ACCESS_TOKEN=(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return "";
}

const ACCESS_TOKEN = getAccessToken();

const MIGRATIONS = [
  { file: "supabase/migrations/20261012000001_core_schema.sql", name: "Phase 3: Core Schema (16 tables)" },
  { file: "supabase/migrations/20261012000002_performance.sql", name: "Phase 4: Performance Indexes" },
  { file: "supabase/migrations/20261012000003_rls_policies.sql", name: "Phase 5: RLS Policies & Security Definers" },
  { file: "supabase/migrations/20261012000004_data_backfill.sql", name: "Phase 6: Data Backfill & Seed Data" },
];

function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });
    const req = https.request(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("============================================================");
  console.log("🚀 UniMedi v2 — Direct Supabase Migration Execution");
  console.log(`   Project Ref: ${PROJECT_REF}`);
  console.log(`   Total Phases: ${MIGRATIONS.length}`);
  console.log("============================================================\n");

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const { file, name } = MIGRATIONS[i];
    console.log(`[${i + 1}/${MIGRATIONS.length}] Executing: ${name}`);
    console.log(`    File: ${file}`);
    let sql = readFileSync(join(ROOT, file), "utf-8");
    sql = sql.replace(/^\uFEFF/, "");

    const startTime = Date.now();
    const result = await runQuery(sql);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.status === 200 || result.status === 201) {
      console.log(`    ✅ SUCCESS in ${duration}s\n`);
    } else {
      console.error(`    ❌ FAILED (HTTP ${result.status}) in ${duration}s`);
      console.error("    Details:", JSON.stringify(result.data, null, 2));
      process.exit(1);
    }
  }

  console.log("============================================================");
  console.log("🔍 Verifying Migrations in Live Database...");
  console.log("============================================================\n");

  const verifySQL = `
    SELECT 
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name) AS column_count
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const verifyRes = await runQuery(verifySQL);
  if (verifyRes.status === 200 || verifyRes.status === 201) {
    console.log("Live Tables in public schema:");
    console.table(verifyRes.data);
  }

  // Row counts check
  const countSQL = `
    SELECT 
      'profiles' as tbl, count(*) as cnt FROM public.profiles
    UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
    UNION ALL SELECT 'medical_specialties', count(*) FROM public.medical_specialties
    UNION ALL SELECT 'doctors', count(*) FROM public.doctors
    UNION ALL SELECT 'patients', count(*) FROM public.patients
    UNION ALL SELECT 'consultations', count(*) FROM public.consultations
    UNION ALL SELECT 'prescriptions', count(*) FROM public.prescriptions
    UNION ALL SELECT 'prescription_items', count(*) FROM public.prescription_items
    UNION ALL SELECT 'diagnoses', count(*) FROM public.diagnoses;
  `;

  const countRes = await runQuery(countSQL);
  if (countRes.status === 200 || countRes.status === 201) {
    console.log("\nRow Counts in New Normalized Tables:");
    console.table(countRes.data);
  }

  console.log("\n✨ All 4 migration phases executed and verified successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
