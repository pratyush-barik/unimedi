# UniMedi — Developer Guide & Architecture Overview

> **Version:** 1.1.0  
> **Framework:** Next.js 16 (App Router + Turbopack)  
> **Styling:** Tailwind CSS v4  
> **Backend/Database:** Supabase PostgreSQL + Resilient Data Provider  
> **Authentication:** Email OTP with Signed HMAC-SHA256 httpOnly Cookies  

---

## 1. Architecture & Security Overview

### A. Authentication & Session Security
- **HMAC-SHA256 httpOnly Cookies**: On successful OTP verification, `/api/verify-otp` issues a cryptographically signed cookie (`session_token`) with `httpOnly`, `sameSite: lax`, and `path: /`.
- **Zero Token Exposure**: Session tokens are never accessible to client JavaScript, preventing token exfiltration via XSS.
- **Server Session Restoration**: Client layouts call `GET /api/session` which decodes the verified payload and restores the active user profile.
- **Patient Auto-Provisioning**: Patients can register via signup or login with a new email. Upon valid OTP entry, a new patient user record is created in `users` with `user_roles.role = 'patient'`. Existing patients are authenticated without duplicate rows.
- **Doctor Provisioning Gate**: Doctor logins are validated against `users` and `user_roles` with `role = 'doctor'`. Arbitrary emails cannot sign in as doctors.

### B. IDOR Protection & Granular Consent Flow
- In `app/doctor/patient/page.tsx`, accessing patient clinical data requires an active row in `doctor_sessions` with `approved = true`.
- Walk-in QR flow initializes sessions with `approved = false`. The patient receives an approval prompt ("Dr. Rajesh Sharma is requesting access") and must tap **Approve** before records unlock.

### C. Resilient Data Provider
- `lib/supabase.ts` implements a resilient query builder with pre-seeded demo records for doctors, patients, appointments, and prescriptions. If the remote Supabase endpoint is unreachable or DNS fails, the system executes gracefully without crashing with `TypeError: fetch failed`.

---

## 2. Project Directory Map

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
│   │   └── page.tsx                    # Master administration dashboard
│   ├── globals.css                     # Global styles, print utilities, Tailwind v4
│   ├── layout.tsx                      # Root layout with Inter font & metadata
│   └── page.tsx                        # Main landing page
├── lib/
│   ├── authClient.ts                   # Client-side session fetcher & logout helper
│   ├── mailer.ts                       # Nodemailer transport & HTML email template
│   ├── otpStore.ts                     # In-memory OTP storage with rate-limiting
│   ├── session.ts                      # HMAC-SHA256 session token signer & cookie options
│   ├── supabase.ts                     # Resilient Supabase client instance
│   └── types.ts                        # TypeScript interfaces for all entities
├── scripts/
│   ├── seed.mjs                        # Database clean wipe and sample seed script
│   └── test_auth_suite.ts              # End-to-end automated authentication test suite
├── supabase_schema.sql                 # Supabase PostgreSQL schema definition
└── vercel.json                         # Vercel daily cron configuration
```

---

## 3. Environment Variables (`.env.local`)

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

## 4. How to Run, Test & Seed

### 1. Install dependencies & run dev server:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Run Automated Auth Test Suite:
```bash
npx tsx scripts/test_auth_suite.ts
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
  - Enter passkey: `unimedi_admin_super_secret_key_2026_9b83a21e4f`
