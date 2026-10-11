import https from "https";
import fs from "fs";
import path from "path";

function getPAT() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const match = envContent.match(/SUPABASE_ACCESS_TOKEN=(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return "";
}

const PAT = getPAT();
const PROJECT_REF = "tqciwohxbdsfbajwnnhh";

function query(sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });
    const req = https.request(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAT}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (chunk) => (d += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve(d);
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
  console.log("=== 1. CURRENT ROW COUNTS AUDIT ===");
  const counts = await query(`
    SELECT 'profiles' as tbl, count(*) as count FROM public.profiles
    UNION ALL SELECT 'patients', count(*) FROM public.patients
    UNION ALL SELECT 'doctors', count(*) FROM public.doctors
    UNION ALL SELECT 'medical_specialties', count(*) FROM public.medical_specialties
    UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
    UNION ALL SELECT 'appointments', count(*) FROM public.appointments
    UNION ALL SELECT 'consultations', count(*) FROM public.consultations
    UNION ALL SELECT 'clinical_vitals', count(*) FROM public.clinical_vitals
    UNION ALL SELECT 'diagnoses', count(*) FROM public.diagnoses
    UNION ALL SELECT 'prescriptions', count(*) FROM public.prescriptions
    UNION ALL SELECT 'prescription_items', count(*) FROM public.prescription_items
    UNION ALL SELECT 'consultation_consents', count(*) FROM public.consultation_consents
    UNION ALL SELECT 'users (legacy to drop)', count(*) FROM public.users
    UNION ALL SELECT 'medical_records (legacy to drop)', count(*) FROM public.medical_records
    UNION ALL SELECT 'doctor_sessions (legacy to drop)', count(*) FROM public.doctor_sessions;
  `);
  console.table(counts);

  console.log("\n=== 2. USERS AUDIT (Are all users in profiles?) ===");
  const missingProfiles = await query(`
    SELECT u.id, u.email 
    FROM public.users u 
    LEFT JOIN public.profiles p ON u.id = p.id 
    WHERE p.id IS NULL;
  `);
  console.log("Users missing from profiles:", missingProfiles);

  console.log("\n=== 3. MEDICAL RECORDS AUDIT (Are all medical_records in consultations & prescriptions?) ===");
  const missingRecords = await query(`
    SELECT mr.id 
    FROM public.medical_records mr 
    LEFT JOIN public.consultations c ON mr.id = c.id 
    WHERE c.id IS NULL;
  `);
  console.log("Medical records missing from consultations:", missingRecords);

  const missingRx = await query(`
    SELECT mr.id 
    FROM public.medical_records mr 
    LEFT JOIN public.prescriptions p ON mr.id = p.consultation_id 
    WHERE p.id IS NULL;
  `);
  console.log("Medical records missing from prescriptions:", missingRx);

  console.log("\n=== 4. DOCTOR SESSIONS AUDIT (Are all doctor_sessions in consultation_consents?) ===");
  const missingSessions = await query(`
    SELECT ds.id 
    FROM public.doctor_sessions ds 
    LEFT JOIN public.consultation_consents cc ON ds.id = cc.id 
    WHERE cc.id IS NULL;
  `);
  console.log("Doctor sessions missing from consultation_consents:", missingSessions);
}

main().catch(console.error);
