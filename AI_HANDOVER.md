# UniMedi — AI Handover & System Architecture Specification

> **System Version:** 2.0.0 (Normalized Production Release)  
> **Target Supabase Instance:** `tqciwohxbdsfbajwnnhh`  
> **Status:** Production-Ready | 100% Data Backfill Verified | Zero Legacy Dependencies  
> **Last Updated:** October 2026  

---

## 1. Executive Summary
**UniMedi** is an enterprise-grade digital healthcare and campus clinical consultation ecosystem built on **Next.js 16 (App Router + Turbopack)**, **Tailwind CSS v4**, and **Supabase PostgreSQL**.

The system completely eliminated all fragile legacy structures (previously flat in-memory stores and unnormalized JSONB tables `users`, `medical_records`, and `doctor_sessions`), transitioning into a **strict 16-table Boyce-Codd Normal Form (BCNF) schema** with fine-grained Row-Level Security (RLS), covered performance indexes, and zero N+1 relational query patterns.

---

## 2. Production Database Schema (16 Normalized Tables)

All live data resides in the `public` schema in Supabase:

| Table | Domain | Primary Purpose & Key Fields |
|---|---|---|
| **`profiles`** | Identity | Thin human authentication bridge linked 1:1 with auth accounts. (`id`, `email`, `full_name`, `phone`, `avatar_url`, `is_active`) |
| **`user_roles`** | Access Control | Explicit RBAC table. (`id`, `user_id`, `role ∈ {'patient', 'doctor', 'admin'}`, `granted_at`, `granted_by`) |
| **`medical_specialties`**| Clinical Lookup | Master specialty directory. (`id`, `name`, `code`, `description`) |
| **`doctors`** | Clinical Directory | Verified professional identities. (`id` $\rightarrow$ `profiles.id`, `specialty_id`, `license_number`, `hospital_affiliation`, `verification_status`) |
| **`patients`** | Clinical Directory | Patient health identity. (`id` $\rightarrow$ `profiles.id`, `aadhaar_hash` SHA-256, `date_of_birth`, `gender`, `blood_group`, `address`, `allergies_summary`) |
| **`appointments`** | Operations | Clinical scheduling for online bookings & walk-in queues. (`id`, `patient_id`, `doctor_id`, `appointment_date`, `time_slot`, `status`, `type`) |
| **`consultations`** | Operations | Immutable clinical encounter records. (`id`, `appointment_id`, `patient_id`, `doctor_id`, `started_at`, `concluded_at`, `chief_complaint`, `clinical_notes`, `status`) |
| **`clinical_vitals`** | Clinical Data | Strongly-typed clinical metrics per consultation. (`id`, `consultation_id`, `systolic_bp`, `diastolic_bp`, `pulse_bpm`, `temperature_f`, `spo2_percent`, `weight_kg`) |
| **`diagnoses`** | Clinical Data | Discrete diagnoses mapped per encounter. (`id`, `consultation_id`, `diagnosis_name`, `icd10_code`, `type ∈ {'primary', 'secondary', 'differential'}`) |
| **`prescriptions`** | Pharmacy | Digitally verifiable prescription header. (`id`, `consultation_id`, `patient_id`, `doctor_id`, `issued_at`, `valid_until`, `is_signed`, `digital_signature_hash`) |
| **`prescription_items`**| Pharmacy | Individual medicine line items. Replaced unnormalized JSON strings. (`id`, `prescription_id`, `medicine_name`, `dosage`, `frequency`, `duration`, `timing`, `special_instructions`) |
| **`medical_documents`** | Diagnostics | Diagnostic uploads & lab PDFs stored in Supabase private storage. (`id`, `patient_id`, `consultation_id`, `uploaded_by`, `title`, `storage_path`, `file_type`, `file_size_bytes`) |
| **`consultation_consents`**| Security / Consent | Auditable consent gate replacing legacy `doctor_sessions`. Append-only / NEVER deleted. (`id`, `patient_id`, `doctor_id`, `status ∈ {'requested', 'granted', 'revoked', 'expired'}`, `expires_at`) |
| **`doctor_qr_tokens`** | Ephemeral Auth | Ephemeral HMAC walk-in QR nonces with 15-minute validity. (`id`, `doctor_id`, `token_nonce`, `expires_at`) |
| **`audit_logs`** | Compliance | Immutable regulatory audit trail. INSERT-only, no UPDATE or DELETE policies. (`id`, `actor_id`, `action`, `resource_type`, `resource_id`, `metadata`, `created_at`) |
| **`user_queries`** | Helpdesk | Patient and doctor support ticketing. (`id`, `user_id`, `name`, `email`, `role`, `subject`, `message`, `status`, `admin_response`) |

---

## 3. Security Architecture & Threat Model

### A. Authentication & Session Management
* **HMAC-SHA256 Signed Cookies**: On OTP verification, `/api/verify-otp` issues a signed `session_token` cookie configured with `httpOnly`, `sameSite: lax`, and `secure` in production.
* **Server-Side Validation**: `/api/session` verifies the HMAC signature and decrypts the active session payload. Client-side JavaScript cannot read or tamper with auth credentials.
* **Universal Database Proxy (`/api/db`)**: Client components make query builder requests through `/api/db`. This proxy validates active iron-session cookies and executes authorized queries via `supabaseAdmin` (`service_role`), completely shielding the database from direct unauthenticated browser access.

### B. IDOR Protection & Consent Gates
* **Doctor Workspace Gate**: Doctors cannot inspect patient historical consultations or prescriptions unless an active `consultation_consents` record with `status = 'granted'` exists for that `(doctor_id, patient_id)` pair and `expires_at > clock_timestamp()`.
* **Zero Deletion Consent Policy**: Unlike legacy `doctor_sessions` which were deleted upon consultation finish, `consultation_consents` rows transition to `status = 'expired'` or `status = 'revoked'` to maintain a permanent legal audit trail.

---

## 4. Keep-Alive Cron Configuration
To prevent Supabase projects from pausing during periods of inactivity:
* **Configuration File**: [`vercel.json`](file:///d:/Projects/unimedi/vercel.json)
```json
{
  "crons": [
    {
      "path": "/api/cron/ping",
      "schedule": "0 0 * * *"
    }
  ]
}
```
* **Cron Route**: [`app/api/cron/ping/route.ts`](file:///d:/Projects/unimedi/app/api/cron/ping/route.ts)
  - Employs zero-egress PostgREST queries: `.from("profiles").select("*", { count: "exact", head: true })`.
  - Only HTTP response headers are transferred (`head: true`), keeping Supabase active with **0 egress bandwidth usage**.
  - Protected via `CRON_SECRET` bearer token verification when invoked by Vercel.

---

## 5. Migration History & Cutover Record
All legacy tables were migrated with 100% data parity and zero data loss:
1. `users` (11 rows) $\rightarrow$ `profiles` (18 rows with seed demos)
2. `legacy_patient_profiles` (14 rows) $\rightarrow$ `patients` (16 deduplicated rows)
3. `legacy_user_roles` (13 rows) $\rightarrow$ `user_roles` (21 rows)
4. `medical_records` (8 rows) $\rightarrow$ `consultations`, `diagnoses`, `prescriptions`, `prescription_items` (8 rows each)
5. `doctor_sessions` (1 row) $\rightarrow$ `consultation_consents` (1 row with ID parity)
6. All legacy tables (`users`, `medical_records`, `doctor_sessions`, `legacy_patient_profiles`, `legacy_user_roles`, `legacy_appointments`) were formally dropped from Supabase after verification.
7. Verification was confirmed via [`scripts/audit_migration.mjs`](file:///d:/Projects/unimedi/scripts/audit_migration.mjs) and [`scripts/check_references.mjs`](file:///d:/Projects/unimedi/scripts/check_references.mjs).

---

## 6. Project Directory Map

```
unimedi/
├── app/
│   ├── api/
│   │   ├── admin/doctors/route.ts      # Doctor admin management (profiles + user_roles + doctors)
│   │   ├── admin/queries/route.ts      # Support queries resolution
│   │   ├── admin/verify/route.ts       # Passkey authentication for /unimedi-admin
│   │   ├── cron/ping/route.ts          # Zero-egress Supabase keep-alive cron
│   │   ├── db/route.ts                 # Secure server-side query proxy
│   │   ├── logout/route.ts             # Session destruction
│   │   ├── send-email-otp/route.ts     # Rate-limited OTP dispatch
│   │   ├── session/route.ts            # Active session verification
│   │   ├── user-queries/route.ts       # Contact / helpdesk submission
│   │   └── verify-otp/route.ts         # Patient auto-provisioning & signed cookie creation
│   ├── components/
│   │   └── PrescriptionPrintModal.tsx  # Standardized clinical PDF printout
│   ├── doctor/
│   │   ├── appointments/page.tsx       # Queue management (relational join)
│   │   ├── dashboard/page.tsx          # Real-time clinical stats & consent alerts
│   │   ├── login/page.tsx              # Doctor credential login
│   │   ├── patient/page.tsx            # Rx builder + vitals + IDOR consent check
│   │   ├── patients/page.tsx           # Treated patients consultation history
│   │   └── qr/page.tsx                 # Clinic walk-in QR generator
│   ├── patient/
│   │   ├── appointments/page.tsx       # Appointment scheduler & formatted slots
│   │   ├── connect/page.tsx            # Walk-in QR scanner & consent approval
│   │   ├── dashboard/page.tsx          # Live consent approvals & quick actions
│   │   ├── history/page.tsx            # Historical clinical encounters
│   │   ├── prescriptions/page.tsx      # Active Rx list with PDF modal
│   │   ├── profile/page.tsx            # Patient clinical demographics editor
│   │   ├── profile-setup/page.tsx      # First-time health onboarding
│   │   ├── signin/page.tsx             # OTP signin
│   │   ├── signup/page.tsx             # OTP registration
│   │   └── support/page.tsx            # Support queries
│   ├── unimedi-admin/
│   │   └── page.tsx                    # Hospital admin dashboard
│   ├── layout.tsx
│   └── page.tsx                        # Home landing page
├── lib/
│   ├── authClient.ts                   # Client auth fetcher
│   ├── mailer.ts                       # Nodemailer transport
│   ├── otpStore.ts                     # In-memory OTP store & rate limiting
│   ├── session.ts                      # HMAC cookie signing & verification
│   ├── supabase.ts                     # Universal query builder & supabaseAdmin
│   └── types.ts                        # TypeScript interfaces for all 16 entities
├── scripts/
│   ├── apply_all_migrations.mjs        # Management API migration runner
│   ├── audit_migration.mjs             # DB row count & foreign-key parity audit
│   ├── check_references.mjs            # Codebase zero-legacy reference scanner
│   └── test_auth_suite.ts              # End-to-end auth test suite
├── supabase/
│   ├── legacy_backup_dump.json         # Raw legacy JSON backup archive
│   └── migrations/
│       ├── 20261012000001_core_schema.sql
│       ├── 20261012000002_performance.sql
│       ├── 20261012000003_rls_policies.sql
│       ├── 20261012000004_data_backfill.sql
│       └── combined_v2_migration.sql
└── vercel.json                         # Vercel daily cron configuration
```
