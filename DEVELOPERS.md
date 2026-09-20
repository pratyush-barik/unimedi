# Developer Guide — UniMedi Healthcare System

Welcome to the **UniMedi** codebase! This document is a quick, practical walkthrough of how the platform works, what changes were made, how to test everything locally, and how to continue development.

---

## 1. Quick Summary of What Changed & Why

### A. Authentication & Security Fixes (Why: Protect Patient Privacy)
- **Before:** The app stored user session data solely in the browser's `localStorage`. Anyone could edit `localStorage` in DevTools to impersonate a doctor or patient.
- **Now:** When you log in with an email OTP, the server generates a cryptographically signed HMAC-SHA256 cookie (`session_token`) that is `httpOnly` and secure. On page load, client pages call `GET /api/session` which verifies the token and returns the current user profile.
- **Why:** Full protection against XSS token theft, session tampering, and broken authentication.

### B. Fixed IDOR Vulnerability & QR Consent Flow (Why: HIPAA/Privacy Compliance)
- **Before:** In `app/doctor/patient/page.tsx`, if any doctor knew or guessed a patient's UUID (`?patientId=...`), they could view all the patient's records without permission. Also, scanning a doctor QR automatically granted access immediately.
- **Now:**
  1. A doctor can **only** view patient history and write prescriptions if an active entry exists in `doctor_sessions` with `approved = true`.
  2. When a patient scans a doctor's QR code (or when a doctor initiates a consultation), the session is marked `approved = false` first.
  3. The patient gets an approval prompt ("Dr. Rajesh Sharma is requesting access. [Approve] [Deny]") on their screen or dashboard. Only when they tap **Approve** does `approved` become `true`.

### C. Fixed Schema & Profile Bugs (Why: Database Errors on Signup)
- **Before:** Several pages (`profile/page.tsx`, `profile-setup/page.tsx`, `signin/page.tsx`) attempted to query a non-existent table called `profiles`.
- **Now:** All user health information (`blood_group`, `gender`, `date_of_birth`, `address`, `phone`) is stored directly on the `users` table, eliminating database query errors.

### D. New Features Added
1. **Admin Panel (`/unimedi-admin`):** Protected by `ADMIN_SECRET` passkey. Lets admins create, edit, or delete doctors, and respond to support queries.
2. **Help & Support Desk (`/patient/support`):** Allows patients and users to submit support tickets stored in `user_queries`.
3. **Daily Cron Keep-Alive (`/api/cron/ping`):** Configured via `vercel.json` to keep the Supabase database awake and prevent auto-pausing.
4. **Vitals & Lab Tests:** Doctors can now enter BP, pulse, temp, SpO2, weight, and ordered lab tests when prescribing.

---

## 2. Project Directory Map

```
unimedi/
├── app/
│   ├── api/
│   │   ├── admin/doctors/route.ts      # Doctor CRUD (GET/POST/PATCH/DELETE)
│   │   ├── admin/queries/route.ts      # Query management (GET/PATCH)
│   │   ├── admin/verify/route.ts       # Validates ADMIN_SECRET passkey
│   │   ├── cron/ping/route.ts          # Supabase keep-alive cron handler
│   │   ├── logout/route.ts             # Clears session cookies
│   │   ├── send-email-otp/route.ts     # Validates input, rate limits, sends OTP
│   │   ├── session/route.ts            # GET: Verifies cookie & returns user profile
│   │   ├── user-queries/route.ts       # POST: Submits support queries
│   │   └── verify-otp/route.ts         # Verifies OTP, signs & sets session cookie
│   ├── components/
│   │   └── PrescriptionPrintModal.tsx  # Standardized printable PDF prescription slip
│   ├── doctor/
│   │   ├── appointments/page.tsx       # Appointment queue management & consultation start
│   │   ├── dashboard/page.tsx          # Real-time active patient session & stats
│   │   ├── login/page.tsx              # Doctor OTP login
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
│   │   ├── signin/page.tsx             # Patient OTP sign in
│   │   ├── signup/page.tsx             # Patient OTP registration
│   │   └── support/page.tsx            # User queries & helpdesk form
│   ├── unimedi-admin/
│   │   └── page.tsx                    # Hidden master administration dashboard
│   ├── globals.css                     # Global styles, print utilities, Tailwind v4
│   ├── layout.tsx                      # Root layout with Inter font & metadata
│   └── page.tsx                        # Main landing page
├── lib/
│   ├── authClient.ts                   # Client-side session fetcher & logout helper
│   ├── mailer.ts                       # Nodemailer transport & HTML email template
│   ├── otpStore.ts                     # In-memory OTP storage with rate-limiting
│   ├── session.ts                      # HMAC-SHA256 session token signer & cookie options
│   ├── supabase.ts                     # Supabase client instance
│   └── types.ts                        # TypeScript interfaces for all entities
├── scripts/
│   └── seed.mjs                        # Database clean wipe and sample seed script
├── supabase_schema.sql                 # Supabase PostgreSQL schema definition
└── vercel.json                         # Vercel daily cron configuration
```

---

## 3. Environment Variables Needed

Create a `.env.local` file in your root folder with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tqciwohxbdsfbajwnnhh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dL6q8W5P_F1z5d2LvZ7GQg_RoFRHW7u
EMAIL_USER=unimedi.app.official@gmail.com
EMAIL_PASS=tnot nhvv klch jwwt
SESSION_SECRET=unimedi_secure_session_secret_f92c8928a30f40dcb76e23971946ec39d5203fa0e620584284d720b080b06b29
ADMIN_SECRET=unimedi_admin_super_secret_key_2026_9b83a21e4f
CRON_SECRET=unimedi_cron_keepalive_secret_2026_c8201fa72d
```

---

## 4. How to Run & Test

### 1. Install dependencies & run dev server:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Reset / Seed Test Data:
To populate the database with fresh test accounts, run:
```bash
node scripts/seed.mjs
```

### 3. Demo Accounts for Testing:
- **Doctor Accounts:**
  - `dr.sharma@unimedi.org` (Cardiology)
  - `dr.ananya@unimedi.org` (General Physician)
  - `dr.kapoor@unimedi.org` (Orthopedics)
- **Patient Accounts:**
  - `arun.patel@student.edu`
  - `priya.verma@student.edu`
  - `rohit.singh@student.edu`
- **Admin Access:**
  - Navigate to [http://localhost:3000/unimedi-admin](http://localhost:3000/unimedi-admin)
  - Enter the passkey: `unimedi_admin_super_secret_key_2026_9b83a21e4f`

### 4. Testing Key Flows:
- **Online Booking Flow:** Log in as `arun.patel@student.edu` &rarr; Book appointment with Dr. Sharma &rarr; Log in as `dr.sharma@unimedi.org` &rarr; Go to Appointments Console &rarr; Accept booking &rarr; Start consultation &rarr; Write Rx with Vitals &rarr; Save & print PDF.
- **Walk-in QR Flow:** Log in as `dr.ananya@unimedi.org` &rarr; Open Clinic QR code &rarr; On another browser/phone, log in as `priya.verma@student.edu` &rarr; Scan QR &rarr; Tap **Approve Access** &rarr; Doctor dashboard will immediately detect the connected patient.
