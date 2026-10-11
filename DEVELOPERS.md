# UniMedi — Developer Onboarding & Architecture Guide

> **Version:** 2.0.0 (Normalized Production Schema)  
> **Framework:** Next.js 16 (App Router + Turbopack)  
> **Database:** Supabase PostgreSQL (16 BCNF Tables)  
> **Language:** TypeScript 5  
> **Styling:** Tailwind CSS v4  

Welcome to UniMedi! This guide covers everything you need to get up and running locally, understand the architectural patterns, and contribute effectively.

---

## 1. Quick Start (Local Setup)

### Prerequisites
- Node.js 18.18+ or 20+
- npm 9+
- Git

### Installation
```bash
# 1. Clone repository
git clone https://github.com/pratyush-barik/unimedi.git
cd unimedi

# 2. Install dependencies
npm install

# 3. Create .env.local file (see Environment Variables section below)
cp .env.example .env.local  # or manually populate .env.local

# 4. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application running.

---

## 2. Environment Variables (`.env.local`)

UniMedi requires the following environment variables in `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tqciwohxbdsfbajwnnhh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dL6q8W5P_F1z5d2LvZ7GQg_RoFRHW7u
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ACCESS_TOKEN=your_supabase_personal_access_token

# Email OTP Service (Google Workspace / Gmail App Password)
EMAIL_USER=unimedi.app.official@gmail.com
EMAIL_PASS=your_gmail_app_password

# Authentication & Admin Security
SESSION_SECRET=unimedi_secure_session_secret_f92c8928a30f40dcb76e23971946ec39d5203fa0e620584284d720b080b06b29
ADMIN_SECRET=unimedi_admin_super_secret_key_2026_9b83a21e4f

# Cron Keep-Alive Verification
CRON_SECRET=unimedi_cron_keepalive_secret_2026_c8201fa72d
```

> [!IMPORTANT]
> - Never commit `.env.local` to Git. GitHub Push Protection will immediately block any commit containing `SUPABASE_ACCESS_TOKEN`.
> - `SUPABASE_ACCESS_TOKEN` is used strictly by migration scripts in `scripts/` to execute DDL via Supabase's Management API.

---

## 3. Database Architecture & Query Patterns

### A. The 16 Normalized Tables
UniMedi uses 16 clean, relational tables. Avoid introducing unnormalized JSON blobs or flat legacy schemas:

1. **`profiles`**: Thin human auth identity (`id` $\rightarrow$ `auth.users.id`).
2. **`user_roles`**: Strict RBAC mapping (`user_id`, `role ∈ {'patient', 'doctor', 'admin'}`).
3. **`medical_specialties`**: Lookup directory for clinical specialties (`code`, `name`).
4. **`doctors`**: Professional credentials (`license_number`, `specialty_id`, `verification_status`).
5. **`patients`**: Clinical demographics (`aadhaar_hash` SHA-256, `blood_group`, `gender`, `date_of_birth`).
6. **`appointments`**: Bookings and queue entries (`time_slot` format: `^\d{2}:\d{2}-\d{2}:\d{2}$`).
7. **`consultations`**: Clinical encounters.
8. **`clinical_vitals`**: Normalized vital signs per encounter.
9. **`diagnoses`**: Primary & secondary diagnostic notes.
10. **`prescriptions`**: Prescription header.
11. **`prescription_items`**: Line items for medicines (`timing ∈ {'After Food', 'Before Food', 'With Food', 'Anytime', 'Empty Stomach'}`).
12. **`medical_documents`**: Lab reports and PDFs in Supabase storage.
13. **`consultation_consents`**: Auditable consent gate for doctor access (`status ∈ {'requested', 'granted', 'revoked', 'expired'}`).
14. **`doctor_qr_tokens`**: Ephemeral walk-in QR nonces.
15. **`audit_logs`**: Regulatory append-only audit trail.
16. **`user_queries`**: Support tickets for patient and doctor helpdesk.

### B. Client-to-Database Flow (Universal Builder)
* Browser components import `{ supabase }` from `@/lib/supabase`.
* In browser environments, queries are routed through [`/api/db`](file:///d:/Projects/unimedi/app/api/db/route.ts). The server proxy validates active session cookies before executing queries via `supabaseAdmin` with `service_role` privileges.
* In server components or API routes, calls execute directly against `supabaseAdmin`.

### C. Eliminating N+1 Queries
Always use PostgREST relational resource embedding instead of looping over array rows:

```typescript
// ✅ RECOMMENDED: Single relational embedding query
const { data: rows } = await supabase
  .from("appointments")
  .select("*, doctors(id, profiles!doctors_id_fkey(full_name, email), medical_specialties(name))")
  .eq("patient_id", patientId)
  .order("appointment_date", { ascending: false });

// ❌ FORBIDDEN: Looping and querying per row (N+1)
for (const a of rows) {
  const { data: doc } = await supabase.from("profiles").select("*").eq("id", a.doctor_id);
}
```

---

## 4. Useful Scripts & Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server with Turbopack |
| `npm run build` | Builds and type-checks the production bundle |
| `node scripts/audit_migration.mjs` | Audits row counts, relations, and data parity in Supabase |
| `node scripts/check_references.mjs` | Scans `app/` and `lib/` for any legacy table references |
| `npx tsx scripts/test_auth_suite.ts` | Runs the end-to-end automated authentication test suite |

---

## 5. Keep-Alive Cron Job

Supabase projects on the free tier pause after 7 days of inactivity. UniMedi prevents pausing automatically:
* **Vercel Cron**: Scheduled daily at `0 0 * * *` via [`vercel.json`](file:///d:/Projects/unimedi/vercel.json).
* **Endpoint**: [`app/api/cron/ping/route.ts`](file:///d:/Projects/unimedi/app/api/cron/ping/route.ts) executes a zero-egress check (`head: true`) on `profiles`, keeping Supabase warm without incurring egress costs.
