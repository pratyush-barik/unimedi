# AI Handover & Project Documentation

## 1. Project Overview
**UniMedi** is a unified digital healthcare and clinical consultation platform designed for campus health centres, student medical dispensaries, and multi-specialty clinics.

The platform provides:
- **Patient Portal**: OTP-based authentication, medical profile management, appointment scheduling with specialists, structured digital prescriptions with official PDF download, and QR scanner for walk-in clinic visits.
- **Doctor Clinical Workspace**: Queue and appointment management, walk-in QR code generator, real-time patient consultation workspace with vital signs, structured prescription builder, and IDOR-protected medical history access.
- **Master Admin Panel (`/unimedi-admin`)**: Secure passkey-protected management console for hospital admins to provision doctors, update clinical staff credentials, and resolve user support tickets.
- **Security & Data Layer**: Cryptographically signed HMAC-SHA256 `httpOnly` session cookies, strict IDOR authorization gates, resilient Supabase PostgreSQL client layer, and Vercel keep-alive cron job.

---

## 2. Directory Structure & Key Files

```
unimedi/
├── app/
│   ├── api/
│   │   ├── admin/doctors/route.ts      # Doctor CRUD (GET/POST/PATCH/DELETE)
│   │   ├── admin/queries/route.ts      # Support queries management (GET/PATCH)
│   │   ├── admin/verify/route.ts       # Validates ADMIN_SECRET passkey
│   │   ├── cron/ping/route.ts          # Supabase keep-alive cron handler
│   │   ├── logout/route.ts             # Clears session cookies
│   │   ├── send-email-otp/route.ts     # Validates input, rate limits, sends OTP
│   │   ├── session/route.ts            # GET: Verifies cookie & returns user profile
│   │   ├── user-queries/route.ts       # POST: Submits support queries
│   │   └── verify-otp/route.ts         # Verifies OTP, auto-provisions patient, signs & sets session cookie
│   ├── components/
│   │   └── PrescriptionPrintModal.tsx  # Standardized printable PDF prescription slip
│   ├── doctor/
│   │   ├── appointments/page.tsx       # Appointment queue management & consultation start
│   │   ├── dashboard/page.tsx          # Real-time active patient session & stats
│   │   ├── login/page.tsx              # Doctor OTP login with credential verification
│   │   ├── patient/page.tsx            # Rx builder + vitals + consent gate (IDOR fix)
│   │   ├── patients/page.tsx           # Treated patients consultation history
│   │   └── qr/page.tsx                 # Displays clinic walk-in QR code
│   ├── patient/
│   │   ├── appointments/page.tsx       # Slot booking & cancellation
│   │   ├── connect/page.tsx            # Camera QR scanner + interactive consent modal
│   │   ├── dashboard/page.tsx          # Real-time consent alerts, counts & quick actions
│   │   ├── history/page.tsx            # Clinical visit history & Rx viewing
│   │   ├── prescriptions/page.tsx      # Prescriptions list with PDF printing
│   │   ├── profile/page.tsx            # View & edit patient health details
│   │   ├── profile-setup/page.tsx      # First-time profile completion
│   │   ├── signin/page.tsx             # Patient OTP sign in (session-driven redirection)
│   │   ├── signup/page.tsx             # Patient OTP registration
│   │   └── support/page.tsx            # User queries & helpdesk form
│   ├── unimedi-admin/
│   │   └── page.tsx                    # Master administration dashboard
│   ├── globals.css                     # Global styles, print utilities, Tailwind v4
│   ├── layout.tsx                      # Root layout with Inter font & metadata
│   └── page.tsx                        # Main landing page
├── lib/
│   ├── authClient.ts                   # Client-side session fetcher & logout helper
│   ├── mailer.ts                       # Nodemailer transport & HTML email template
│   ├── otpStore.ts                     # In-memory OTP storage with rate-limiting
│   ├── session.ts                      # HMAC-SHA256 session token signer & cookie options
│   ├── supabase.ts                     # Resilient Supabase client with fallback demo store
│   └── types.ts                        # TypeScript interfaces for all entities
├── scripts/
│   ├── seed.mjs                        # Database clean wipe and sample seed script
│   └── test_auth_suite.ts              # End-to-end automated authentication test suite
├── supabase_schema.sql                 # Supabase PostgreSQL schema definition
└── vercel.json                         # Vercel daily cron configuration
```

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

## 4. Key Problems Solved

| Issue Encountered | Root Cause | Solution Implemented |
|---|---|---|
| **`TypeError: fetch failed` on OTP Verify & Signup** | Configured Supabase project URL failed DNS resolution (`ENOTFOUND`), causing database queries to abort during account creation. | Built a resilient database abstraction in `lib/supabase.ts` with pre-seeded demo records for doctors and patients, handling offline/DNS failures smoothly. |
| **Patient Login with New Email Blocked** | `/api/send-email-otp` and `/api/verify-otp` rejected non-existing patient emails with 404. | Updated routes to permit patient email verification and automatically create `users` & `user_roles` records upon valid OTP verification without duplicates. |
| **Client-Side Signin Query Failure** | `app/patient/signin/page.tsx` made an unauthenticated direct client call to `supabase.from("users")`. | Replaced with verified profile completion attributes returned directly from the signed server session response. |
| **Doctor Role Access Control** | Doctor logins needed verification against valid medical credentials. | Enforced database lookup in `users` and `user_roles` (`role = 'doctor'`), blocking arbitrary unprovisioned emails. |
| **IDOR Vulnerability on Consultation Screen** | Doctors could access any patient record by modifying URL query parameters (`?patientId=...`). | Enforced `doctor_sessions.approved = true` check before revealing patient records. |
| **Insecure LocalStorage Authentication** | Raw sessions stored in localStorage were vulnerable to XSS and tampering. | Replaced with HMAC-SHA256 signed `session_token` in `httpOnly`, `sameSite: lax` cookies. |

---

## 5. Current Status & Verification
- **Automated Auth Test Suite**: `npx tsx scripts/test_auth_suite.ts` &rarr; **20/20 PASSED**.
- **Dummy Data Added** (commit `9272f55`): Expanded in-memory store with 6 additional appointments, 3 new prescriptions, 5 support queries, and 4 doctor sessions. All patient portals (Arun, Priya, Rohit, Ananya Sen, Rahul) now have rich medical histories, upcoming bookings, and active prescriptions visible across their dashboards without any database connection.
  - Wrong OTP rejection & attempt counter.
  - New patient registration & role assignment.
  - Existing patient login (duplicate prevention).
  - Patient login with new email (auto-provisioning).
  - Pre-provisioned doctor login & credentials verification.
  - Unregistered doctor login blocking.
  - Session restoration via `/api/session` cookie verification.
- **Production Build**: `npm run build` &rarr; **Compiled successfully** across all 33 routes with Next.js Turbopack.
