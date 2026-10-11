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

function run(sql) {
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
            resolve({ status: res.statusCode, data: JSON.parse(d) });
          } catch {
            resolve({ status: res.statusCode, data: d });
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
  console.log("🚀 Completing 100% Legacy Data Migration & Inconsistency Resolution...");

  const sql = `
    -- 1. Backfill all remaining patient profiles
    INSERT INTO public.patients (id, gender, blood_group, created_at, updated_at)
    SELECT DISTINCT ON (lp.user_id)
        lp.user_id,
        CASE 
            WHEN LOWER(TRIM(lp.gender)) IN ('male', 'female', 'other', 'prefer_not_to_say') 
                THEN LOWER(TRIM(lp.gender))
            ELSE NULL 
        END AS gender,
        CASE 
            WHEN UPPER(TRIM(lp.blood_group)) IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') 
                THEN UPPER(TRIM(lp.blood_group))
            ELSE NULL 
        END AS blood_group,
        COALESCE(lp.created_at, NOW()),
        COALESCE(lp.created_at, NOW())
    FROM public.legacy_patient_profiles lp
    WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lp.user_id)
    ORDER BY lp.user_id, lp.created_at DESC
    ON CONFLICT (id) DO UPDATE SET
        gender = COALESCE(public.patients.gender, EXCLUDED.gender),
        blood_group = COALESCE(public.patients.blood_group, EXCLUDED.blood_group);

    -- 2. Backfill remaining medical record (0e95ff0b-cf54-4a6f-9cb9-0790255f9c77)
    INSERT INTO public.consultations (
        id, appointment_id, patient_id, doctor_id,
        started_at, concluded_at, chief_complaint, clinical_notes, status, created_at
    )
    SELECT
        mr.id,
        NULL AS appointment_id,
        mr.patient_id,
        mr.doctor_id,
        COALESCE(mr.created_at, NOW()),
        COALESCE(mr.created_at, NOW()),
        CASE 
            WHEN char_length(TRIM(mr.diagnosis)) >= 3 THEN TRIM(mr.diagnosis)
            ELSE 'General Consultation'
        END AS chief_complaint,
        mr.notes,
        'completed',
        COALESCE(mr.created_at, NOW())
    FROM public.medical_records mr
    WHERE mr.id = '0e95ff0b-cf54-4a6f-9cb9-0790255f9c77'
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.prescriptions (
        consultation_id, patient_id, doctor_id,
        issued_at, valid_until, general_instructions,
        is_signed, is_legacy_import
    )
    SELECT
        c.id, c.patient_id, c.doctor_id,
        c.started_at, (c.started_at + INTERVAL '30 days')::DATE,
        c.clinical_notes, TRUE, TRUE
    FROM public.consultations c
    WHERE c.id = '0e95ff0b-cf54-4a6f-9cb9-0790255f9c77'
    ON CONFLICT (consultation_id) DO NOTHING;

    INSERT INTO public.prescription_items (
        prescription_id, medicine_name, dosage, frequency, duration, timing, special_instructions, is_legacy_import
    )
    SELECT
        p.id,
        INITCAP(COALESCE(NULLIF(TRIM(mr.medicines), ''), 'General Medication')),
        'as directed', 'SOS', 'as directed', 'Anytime', 'Migrated from legacy medical record', TRUE
    FROM public.medical_records mr
    JOIN public.prescriptions p ON p.consultation_id = mr.id
    WHERE mr.id = '0e95ff0b-cf54-4a6f-9cb9-0790255f9c77'
    ON CONFLICT DO NOTHING;

    INSERT INTO public.diagnoses (
        consultation_id, icd10_code, diagnosis_name, type, notes
    )
    SELECT
        mr.id, 'R69',
        CASE WHEN char_length(TRIM(mr.diagnosis)) >= 3 THEN TRIM(mr.diagnosis) ELSE 'General Consultation' END,
        'primary', 'Imported from legacy medical record'
    FROM public.medical_records mr
    WHERE mr.id = '0e95ff0b-cf54-4a6f-9cb9-0790255f9c77'
    ON CONFLICT DO NOTHING;
  `;

  const res = await run(sql);
  console.log("Migration Result:", res.status, res.data);
}

main().catch(console.error);
