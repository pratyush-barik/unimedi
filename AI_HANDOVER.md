# AI Handover Document — UniMedi Healthcare System

**Date:** September 20, 2026  
**Project:** UniMedi — Unified Smart Healthcare & Consultation Platform  
**Repository Branch:** `main`  
**Framework & Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + RLS), Nodemailer (custom Gmail OTP), html5-qrcode, react-qr-code.

---

## 1. Project Overview & Current Capabilities
UniMedi is a digital healthcare platform designed for college campus/clinic environments (~10,000 target users). It bridges physical walk-in clinics and online booking systems with privacy-first patient consent mechanisms.

### Core Features:
1. **Dual-Mode Consultation Model:**
   - **Online Booking:** Patients select verified doctors, choose dates/time slots, provide reasons for visit, and track approval states.
   - **Walk-in QR Code Check-in:** Doctors generate clinic QR codes; patients scan via camera (`html5-qrcode`) to initiate an in-clinic consultation request with explicit patient authorization.
2. **Patient Consent & Access Gate:**
   - Medical records and prescriptions are protected: doctors can only view patient history and issue prescriptions if a `doctor_sessions` row exists with `approved = true`.
   - Never auto-approved: patient receives an interactive approval modal upon scan or from their dashboard to grant/deny access.
3. **Structured Digital Prescriptions & Printable PDF:**
   - Standardized prescription builder (`Diagnosis`, `Structured Medicines`, `Patient Vitals` [BP, Pulse, Temp, SpO2, Weight], `Lab Tests Ordered`, and `Doctor Advice`).
   - Printable PDF slips generated using `@app/components/PrescriptionPrintModal.tsx`.
4. **Master Administration Console (`/unimedi-admin`):**
   - Protected with server-side `ADMIN_SECRET` passkey.
   - Doctor CRUD (register, update, remove practitioners).
   - User queries & support ticket helpdesk.
   - Real-time system metrics (patients, doctors, bookings, active sessions).
5. **Supabase Keep-Alive Cron Job:**
   - Vercel daily cron trigger at `/api/cron/ping` with `CRON_SECRET` protection to prevent Supabase inactivity auto-pausing.

---

## 2. Exact Files & Directories Modified / Created

### Core Authentication & Security Foundation
- `lib/session.ts` *(NEW)*: Cryptographic HMAC-SHA256 session token generation and verification using Web Crypto / Node crypto. Sets secure `session_token` cookie (`httpOnly`, `sameSite: lax`, `path: /`, 7-day expiry).
- `lib/authClient.ts` *(NEW)*: Client-side session fetcher (`/api/session`) and unified logout helper.
- `lib/otpStore.ts` *(MODIFIED)*: Added rate limiting (minimum 30s interval between dispatches) and brute-force protection (max 5 attempts before invalidating OTP).
- `lib/mailer.ts` *(MODIFIED)*: Branded HTML email template for 6-digit OTP delivery matching UniMedi indigo palette.
- `lib/types.ts` *(MODIFIED)*: Added TypeScript definitions for `MedicineItem`, `Vitals`, `LabTest`, `Appointment`, `MedicalRecord`, `Report`, `UserQuery`, `DoctorSession`, `SessionPayload`.
- `app/api/send-email-otp/route.ts` *(MODIFIED)*: Input validation (regex), rate limiting, role verification for login.
- `app/api/verify-otp/route.ts` *(MODIFIED)*: Verifies OTP, sets signed `httpOnly` `session_token` cookie, sanitizes returned user fields.
- `app/api/session/route.ts` *(NEW)*: Validates signed session cookie on mount, fetches latest user profile from Supabase.
- `app/api/logout/route.ts` *(MODIFIED)*: Securely clears `session_token` and legacy session cookies with `maxAge: 0`.

### Cron & Database Keep-Alive
- `vercel.json` *(NEW)*: Configures Vercel Cron (`0 0 * * *` daily trigger to `/api/cron/ping`).
- `app/api/cron/ping/route.ts` *(NEW)*: Executes keep-alive count query against Supabase, authenticated via `CRON_SECRET`.

### Admin Panel & User Helpdesk APIs
- `app/api/admin/verify/route.ts` *(NEW)*: Validates admin secret passkey.
- `app/api/admin/doctors/route.ts` *(NEW)*: Full CRUD (GET, POST, PATCH, DELETE) for medical doctors.
- `app/api/admin/queries/route.ts` *(NEW)*: Fetches support queries, updates statuses, and saves admin responses.
- `app/api/user-queries/route.ts` *(NEW)*: Patient/user endpoint to submit support tickets.
- `app/unimedi-admin/page.tsx` *(NEW)*: Master administration UI with passkey protection, doctor management, and support helpdesk.
- `app/patient/support/page.tsx` *(NEW)*: Contact/support ticket submission page.

### Critical Security & Consent Flow Fixes
- `app/doctor/patient/page.tsx` *(MODIFIED)*: **Fixed Critical IDOR**. Doctors cannot access patient records simply by passing `?patientId=X` unless `doctor_sessions.approved = true`. Added vitals builder, lab tests builder, and Rx PDF generator.
- `app/doctor/appointments/page.tsx` *(MODIFIED)*: Fixed consultation initiation to respect patient consent, added status filters, responsive appointment cards.
- `app/patient/connect/page.tsx` *(MODIFIED)*: Fixed QR scan flow. Inserts session with `approved = false` and displays interactive patient consent authorization modal with Doctor details and Approve/Deny buttons.
- `app/patient/dashboard/page.tsx` *(MODIFIED)*: Real-time consent request banner allowing patients to approve or deny incoming doctor access requests with one click.

### Patient & Doctor Pages UI Refactor
- `app/globals.css` *(MODIFIED)*: Clean scrollbars, print styles, and typography tokens.
- `app/layout.tsx` *(MODIFIED)*: Metadata, viewport, and typography styling.
- `app/page.tsx` *(MODIFIED)*: Premium landing hero with portals for Patient, Doctor, and Helpdesk.
- `app/patient/signin/page.tsx` *(MODIFIED)*: Replaced broken `profiles` table query with `users` table check; integrated signed session token auth.
- `app/patient/signup/page.tsx` *(MODIFIED)*: Clean 6-digit OTP registration.
- `app/patient/profile-setup/page.tsx` *(MODIFIED)*: Fixed schema mapping to update `users` table directly (`blood_group`, `gender`, `date_of_birth`, `address`).
- `app/patient/profile/page.tsx` *(MODIFIED)*: Direct view/edit of `users` table health details.
- `app/patient/appointments/page.tsx` *(MODIFIED)*: Slot booking form, active bookings list, cancellation.
- `app/patient/prescriptions/page.tsx` & `app/patient/history/page.tsx` *(MODIFIED)*: Structured prescription views, PDF export modal.
- `app/doctor/login/page.tsx` *(MODIFIED)*: Doctor OTP login with signed session cookie.
- `app/doctor/dashboard/page.tsx` *(MODIFIED)*: Real-time active session banner, appointment metrics.
- `app/doctor/qr/page.tsx` *(MODIFIED)*: Clean QR code generator with doctor metadata.
- `app/doctor/patients/page.tsx` *(MODIFIED)*: Treated patient consultation history.
- `app/components/PrescriptionPrintModal.tsx` *(MODIFIED)*: Standardized official prescription print layout with vitals, medicines, lab tests, and signature block.

### Database Schema & Seed Script
- `supabase_schema.sql` *(MODIFIED)*: Updated with `doctor_sessions.approved DEFAULT FALSE`, `medical_records.lab_tests JSONB`, `reports` table, `user_queries` table, and RLS policies.
- `scripts/seed.mjs` *(NEW)*: Complete database clean wipe and seed script with demo doctors, patients, appointments, prescriptions, and support queries.
- `.gitignore` *(MODIFIED)*: Added `env.download` and environment files.

---

## 3. Database Schema Overview (PostgreSQL on Supabase)
- **`users`**: `id` (UUID PK), `email` (TEXT UNIQUE), `full_name` (TEXT), `phone` (TEXT), `date_of_birth` (DATE), `gender` (TEXT), `blood_group` (TEXT), `address` (TEXT), `created_at`, `updated_at`.
- **`user_roles`**: `id` (UUID PK), `user_id` (FK -> users), `role` ('patient' | 'doctor' | 'admin'), `speciality` (TEXT), `license_number` (TEXT), `hospital_affiliation` (TEXT), `created_at`.
- **`doctor_sessions`**: `id` (UUID PK), `doctor_id` (FK -> users), `patient_id` (FK -> users), `approved` (BOOLEAN DEFAULT FALSE), `created_at`.
- **`appointments`**: `id` (UUID PK), `patient_id` (FK -> users), `doctor_id` (FK -> users), `appointment_date` (DATE), `time_slot` (TEXT), `type` ('online_booking' | 'walk_in_qr'), `status` ('pending' | 'confirmed' | 'in_consultation' | 'completed' | 'cancelled'), `reason_for_visit` (TEXT), `doctor_notes` (TEXT), `created_at`, `updated_at`.
- **`medical_records`**: `id` (UUID PK), `patient_id` (FK -> users), `doctor_id` (FK -> users), `appointment_id` (FK -> appointments NULLABLE), `diagnosis` (TEXT), `medicines` (JSONB), `vitals` (JSONB), `lab_tests` (JSONB), `notes` (TEXT), `created_at`.
- **`reports`**: `id` (UUID PK), `patient_id` (FK -> users), `medical_record_id` (FK -> medical_records NULLABLE), `title` (TEXT), `file_url` (TEXT), `file_type` (TEXT), `uploaded_at`.
- **`user_queries`**: `id` (UUID PK), `user_id` (FK -> users NULLABLE), `name` (TEXT), `email` (TEXT), `role` (TEXT), `subject` (TEXT), `message` (TEXT), `status` ('pending' | 'in_review' | 'resolved'), `admin_response` (TEXT), `created_at`, `updated_at`.

---

## 4. Problems Faced & Solutions Applied
| Issue Encountered | Root Cause | Solution Implemented |
|---|---|---|
| **Broken Table Reference in Profile setup** | Old code queried `from("profiles")` which did not exist in verified Supabase schema. | Shifted all patient profile reads/writes to `users` table (`blood_group`, `gender`, `date_of_birth`, `address`). |
| **Critical IDOR on Doctor Patient page** | `app/doctor/patient/page.tsx` loaded any patient if `?patientId=UUID` was in URL without verifying authorization. | Added strict check: queries `doctor_sessions` for `approved = true`. If missing or false, displays a blocked consent barrier screen. |
| **Instant Auto-Approval in QR Flow** | Scanning a QR immediately inserted `approved: true` without asking patient. | Modified to insert with `approved: false` and display an interactive Doctor Consent Card for explicit patient approval. |
| **Insecure LocalStorage Auth** | Client pages trusted `localStorage.getItem("session")` which could be forged in devtools. | Implemented HMAC-SHA256 signed `session_token` httpOnly cookies, verified on server routes (`GET /api/session`). |
| **Vercel Inactivity Pausing Supabase** | Free-tier Supabase pauses after periods of no SQL activity. | Created `vercel.json` cron config calling `/api/cron/ping` daily. |

---

## 5. Current Status & What is Pending

### Completed:
- [x] Full security hardening (HMAC session tokens, httpOnly cookies, IDOR fix, rate limiting).
- [x] Complete patient workflow (Sign in, Sign up, Profile Setup, Profile Edit, Appointments booking, Prescriptions PDF, QR Scan with consent).
- [x] Complete doctor workflow (Login, Appointments console, QR generator, In-clinic Consultation workspace with Vitals & Lab tests, Treated patients list).
- [x] Master admin panel at `/unimedi-admin` with passkey security, Doctor CRUD, and Support Desk.
- [x] Supabase keep-alive cron job endpoint and `vercel.json` configuration.
- [x] Clean database seed script (`scripts/seed.mjs`).

### Pending / Next Steps for Future Iterations:
- Run `node scripts/seed.mjs` against Supabase if you want to reset all test data.
- Add Supabase Storage bucket for patient file attachments if PDF upload is needed in the `reports` table.
- Execute automated end-to-end testing with Playwright/Cypress if required.
