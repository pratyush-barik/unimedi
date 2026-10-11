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

const ddl = `
CREATE TABLE IF NOT EXISTS public.auth_otps (
    email        TEXT PRIMARY KEY,
    otp_code     TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '10 minutes'),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'auth_otps' AND policyname = 'service_role_all_auth_otps'
    ) THEN
        CREATE POLICY service_role_all_auth_otps ON public.auth_otps 
        FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

const payload = JSON.stringify({ query: ddl });
const req = https.request(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: "Bearer " + PAT,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  }
}, (res) => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => console.log("Create auth_otps result:", d));
});
req.write(payload);
req.end();
