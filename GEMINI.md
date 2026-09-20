# UniMedi Development Guidelines

## Project Context
- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Storage), Nodemailer (custom email OTP), html5-qrcode, qrcode, react-qr-code.
- **Roles**: Patient & Doctor (active). Admin role exists in DB (`user_roles.role IN ('patient','doctor','admin')`) but only accessible via hidden URL `/unimedi-admin`. No receptionist role in this phase.
- **Deployment**: Vercel. All server-only env vars must NOT have `NEXT_PUBLIC_` prefix.

## Operation & File Access Rules
- All files within this project repository are authorized for read, write, and development operations.
- Preserve Supabase client conventions (`@/lib/supabase.ts`) and ensure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EMAIL_USER`, `EMAIL_PASS`) are maintained.
- Ensure strict role separation (Doctor vs. Patient) across routes and database access.

## Verified Database Schema (as of Sept 2026)
Tables in `public` schema:
- `users` — id (UUID), email, full_name, phone, date_of_birth, gender, blood_group, address, created_at, updated_at
- `user_roles` — id, user_id (→ users), role ('patient'|'doctor'|'admin'), speciality, license_number, hospital_affiliation, created_at
- `doctor_sessions` — id, doctor_id (→ users), patient_id (→ users), approved (BOOLEAN), created_at
- `appointments` — id, patient_id, doctor_id, appointment_date, time_slot, type ('online_booking'|'walk_in_qr'), status ('pending'|'confirmed'|'in_consultation'|'completed'|'cancelled'), reason_for_visit, doctor_notes, created_at, updated_at
- `medical_records` — id, patient_id, doctor_id, appointment_id, diagnosis, medicines (JSONB), notes, vitals (JSONB), lab_tests (JSONB), created_at
- `reports` — id, patient_id, medical_record_id, title, file_url, uploaded_at
- RLS is ENABLED on all tables, but policies are currently open (USING true) for MVP.

## Authentication Architecture
- **OTP**: Custom 6-digit OTP generated server-side via `lib/otpStore.ts`, sent via Nodemailer from `EMAIL_USER`. 5-minute expiry.
- **Session**: After OTP verification, a signed session token is issued as a **secure, httpOnly, SameSite=Lax cookie** (`session_token`). Do NOT use localStorage as the primary session mechanism.
- **Session API**: `GET /api/session` returns `{ userId, email, role }` from the cookie. All client pages call this on mount.
- **Logout**: `POST /api/logout` clears the cookie. `SESSION_SECRET` env var used for token signing.
- **Do NOT** use Supabase Auth — authentication is custom (email OTP).

## QR Consultation Flow
1. Doctor opens `/doctor/qr` → generates a QR containing their `user_id`.
2. Patient scans QR at `/patient/connect` → a `doctor_sessions` row is created with `approved=false`.
3. Patient sees an approval prompt → taps **Approve** → `approved=true` → doctor can view records.
4. Patient can also see and manage pending requests from their dashboard.
5. Doctor can only view a patient's medical records if a `doctor_sessions` row exists with `approved=true` for that pair.

## Admin Panel
- Route: `/unimedi-admin` — a hidden Next.js page. Not linked from anywhere in the app.
- Protected by `ADMIN_SECRET` env var (server-only, never `NEXT_PUBLIC_`).
- Shows user list, appointment overview, doctor sessions overview.

## Key Constraints (Never Violate)
- Never use `localStorage` as the sole auth mechanism — always back up with httpOnly cookie.
- Never expose `SESSION_SECRET` or `ADMIN_SECRET` in client code or `NEXT_PUBLIC_` vars.
- Never auto-approve a `doctor_sessions` row — always require explicit patient approval.
- Never skip the `doctor_sessions` check before showing patient records to a doctor.
- Never add receptionist as a role without updating the DB `CHECK` constraint.
- Never link to `/unimedi-admin` from any visible UI element.
- Do NOT redesign the UI — keep the blue/indigo gradient, white card, Tailwind aesthetic.
- Do NOT switch to Supabase Auth — the project uses custom Nodemailer OTP.

## UI Design Direction
- Color palette: indigo-600 (primary), emerald-600 (success/scan), rose (danger), amber (profile), blue (history).
- Cards: `rounded-3xl`, `shadow-sm`, `border border-gray-100`, hover: `-translate-y-1 shadow-xl`.
- Background: `bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60`.
- Typography: bold headings (`font-extrabold tracking-tight`), muted body (`text-gray-500`).
- Do NOT use dark mode, glassmorphism, or TailwindCSS v3 syntax (project uses Tailwind v4).

## Environment Variables Required
| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client+Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client+Server | Supabase anon key |
| `EMAIL_USER` | Server-only | Nodemailer Gmail sender |
| `EMAIL_PASS` | Server-only | Gmail App Password |
| `SESSION_SECRET` | Server-only | Signs session tokens |
| `ADMIN_SECRET` | Server-only | Admin panel password |
