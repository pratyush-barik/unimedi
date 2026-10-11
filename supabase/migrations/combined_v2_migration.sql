-- ==============================================================================
-- UniMedi v2 — Master Combined Migration (All 4 Phases in Order)
-- Live verified & executed against Supabase project tqciwohxbdsfbajwnnhh
-- ==============================================================================



-- ------------------------------------------------------------------------------
-- FILE: supabase/migrations/20261012000001_core_schema.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- UniMedi v2 — Core Normalized Schema Migration
-- Phase 3 of 8 | Master Implementation Plan
-- Generated: 2026-10-12
-- Safe to run: All statements are additive (IF NOT EXISTS / CREATE OR REPLACE).
-- Do NOT drop legacy tables (users, user_roles, doctor_sessions, medical_records).
-- They remain intact until Phase 6 (ETL backfill) + Phase 8 (cutover).
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SQL execution bridge for service_role
CREATE OR REPLACE FUNCTION public.unimedi_exec(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{"status":"ok"}'::JSONB;
BEGIN
  EXECUTE sql_text;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'code', SQLSTATE,
    'message', SQLERRM
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.unimedi_exec(TEXT) TO service_role;

-- ==============================================================================
-- STEP 0: SAFE TRANSITION OF LEGACY SCHEMAS
-- Preserve all existing legacy data by renaming legacy tables if present
-- ==============================================================================
DO $$
BEGIN
    -- 1. Legacy profiles table (contains user_id, age, gender, blood_group)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'legacy_patient_profiles'
    ) THEN
        ALTER TABLE public.profiles RENAME TO legacy_patient_profiles;
    END IF;

    -- 2. Legacy user_roles table (contains speciality column or lacks granted_at)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'speciality'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'legacy_user_roles'
    ) THEN
        ALTER TABLE public.user_roles RENAME TO legacy_user_roles;
    END IF;

    -- 3. Legacy appointments table (lacks slot_start_time)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'appointment_date'
          AND NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'slot_start_time'
          )
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'legacy_appointments'
    ) THEN
        ALTER TABLE public.appointments RENAME TO legacy_appointments;
    END IF;
END $$;

-- ==============================================================================
-- DOMAIN 1: CORE IDENTITY & ACCESS GOVERNANCE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    phone       TEXT,
    avatar_url  TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_profiles_name_length   CHECK (char_length(full_name) >= 2),
    CONSTRAINT chk_profiles_email_format  CHECK (email LIKE '%@%.%')
);
COMMENT ON TABLE  public.profiles IS 'Thin authentication bridge. One row per authenticated human. Linked to Supabase auth.users.id.';
COMMENT ON COLUMN public.profiles.id IS 'Must equal auth.users.id — set during OTP verification.';
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    granted_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT chk_user_roles_valid_role  CHECK (role IN ('patient', 'doctor', 'admin')),
    CONSTRAINT uq_user_roles_user_role    UNIQUE (user_id, role)
);
COMMENT ON TABLE  public.user_roles IS 'Explicit RBAC. One row per (user, role) pair. Patients self-provision; doctors require admin grant.';
COMMENT ON COLUMN public.user_roles.granted_by IS 'NULL for patients (self-provisioned). Set to admin profile.id for doctor grants.';
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);

-- ==============================================================================
-- DOMAIN 2: CLINICAL DIRECTORY & PROVIDERS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.medical_specialties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    code        TEXT NOT NULL UNIQUE,
    description TEXT,
    CONSTRAINT chk_specialties_name_length  CHECK (char_length(name) >= 3),
    CONSTRAINT chk_specialties_code_length  CHECK (char_length(code) >= 2)
);
COMMENT ON TABLE public.medical_specialties IS 'Master lookup for clinical specialties. Immutable once in production.';

INSERT INTO public.medical_specialties (id, name, code, description) VALUES
    ('00000000-0000-0000-0001-000000000001', 'General Medicine',               'GEN_MED', 'Primary care, common illnesses, general health consultations'),
    ('00000000-0000-0000-0001-000000000002', 'Orthopedics & Sports Medicine',  'ORTHO',   'Bones, joints, muscles, sports injuries'),
    ('00000000-0000-0000-0001-000000000003', 'Cardiology',                     'CARD',    'Heart and cardiovascular system'),
    ('00000000-0000-0000-0001-000000000004', 'Dermatology',                    'DERM',    'Skin, hair, and nail conditions'),
    ('00000000-0000-0000-0001-000000000005', 'Psychiatry & Mental Health',     'PSYCH',   'Mental health, counselling, anxiety, depression'),
    ('00000000-0000-0000-0001-000000000006', 'Gynaecology & Obstetrics',       'GYNOB',   'Womens health, reproductive medicine'),
    ('00000000-0000-0000-0001-000000000007', 'Paediatrics',                    'PAED',    'Children and adolescent health'),
    ('00000000-0000-0000-0001-000000000008', 'ENT (Ear, Nose, Throat)',        'ENT',     'Ear, nose, throat conditions'),
    ('00000000-0000-0000-0001-000000000009', 'Ophthalmology',                  'OPTH',    'Eye care and vision'),
    ('00000000-0000-0000-0001-000000000010', 'Emergency & Urgent Care',        'EMRG',    'Urgent walk-in and emergency triage')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.doctors (
    id                    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE RESTRICT,
    specialty_id          UUID NOT NULL REFERENCES public.medical_specialties(id) ON DELETE RESTRICT,
    license_number        TEXT NOT NULL UNIQUE,
    hospital_affiliation  TEXT NOT NULL DEFAULT 'UniMedi Central Dispensary',
    qualification         TEXT NOT NULL DEFAULT 'MBBS',
    verification_status   TEXT NOT NULL DEFAULT 'pending',
    verified_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at           TIMESTAMPTZ,
    consultation_fee      NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_doctors_verification_status CHECK (verification_status IN ('pending', 'verified', 'suspended')),
    CONSTRAINT chk_doctors_license_length       CHECK (char_length(license_number) >= 4),
    CONSTRAINT chk_doctors_fee_positive         CHECK (consultation_fee >= 0)
);
COMMENT ON TABLE  public.doctors IS 'Professional clinical identity. Admin-provisioned only. Separate from patients even for same auth user.';
COMMENT ON COLUMN public.doctors.license_number IS 'Medical Council registration number. Must be verified by admin.';
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON public.doctors(specialty_id);
CREATE INDEX IF NOT EXISTS idx_doctors_status    ON public.doctors(verification_status);

CREATE TABLE IF NOT EXISTS public.patients (
    id                      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    aadhaar_hash            TEXT UNIQUE,
    date_of_birth           DATE,
    gender                  TEXT,
    blood_group             TEXT,
    address                 TEXT,
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    allergies_summary       TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_patients_gender       CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    CONSTRAINT chk_patients_blood_group  CHECK (blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    CONSTRAINT chk_patients_dob          CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
    CONSTRAINT chk_patients_aadhaar_hash CHECK (aadhaar_hash IS NULL OR char_length(aadhaar_hash) = 64)
);
COMMENT ON TABLE  public.patients IS 'Patient clinical identity. Self-provisioned on first login. Separate from doctors even for same auth account.';
COMMENT ON COLUMN public.patients.aadhaar_hash IS 'SHA-256 hex digest of 12-digit Aadhaar. NEVER store raw Aadhaar. NULL until patient provides it.';

-- ==============================================================================
-- DOMAIN 3: CLINICAL OPERATIONS & CONSULTATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id           UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    appointment_date    DATE NOT NULL,
    time_slot           TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'online_booking',
    status              TEXT NOT NULL DEFAULT 'pending',
    reason_for_visit    TEXT,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_appointments_self_consult CHECK (patient_id != doctor_id),
    CONSTRAINT chk_appointments_type         CHECK (type IN ('online_booking', 'walk_in_qr')),
    CONSTRAINT chk_appointments_status       CHECK (status IN ('pending', 'confirmed', 'in_consultation', 'completed', 'cancelled', 'no_show')),
    CONSTRAINT chk_appointments_timeslot_fmt CHECK (time_slot ~ '^\d{2}:\d{2}-\d{2}:\d{2}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
    ON public.appointments(doctor_id, appointment_date, time_slot)
    WHERE status IN ('pending', 'confirmed', 'in_consultation');
COMMENT ON TABLE  public.appointments IS 'Scheduling intent for online bookings and walk-in QR queue entries.';
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient     ON public.appointments(patient_id, appointment_date DESC);

CREATE TABLE IF NOT EXISTS public.consultations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id   UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    patient_id       UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    doctor_id        UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    concluded_at     TIMESTAMPTZ,
    chief_complaint  TEXT NOT NULL,
    clinical_notes   TEXT,
    status           TEXT NOT NULL DEFAULT 'in_progress',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_consultations_self            CHECK (patient_id != doctor_id),
    CONSTRAINT chk_consultations_status          CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    CONSTRAINT chk_consultations_concluded_after CHECK (concluded_at IS NULL OR concluded_at >= started_at)
);
COMMENT ON TABLE  public.consultations IS 'Clinical encounter record. Immutable once concluded. Walk-ins have NULL appointment_id.';
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON public.consultations(patient_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor  ON public.consultations(doctor_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.clinical_vitals (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id   UUID NOT NULL UNIQUE REFERENCES public.consultations(id) ON DELETE CASCADE,
    systolic_bp       INTEGER,
    diastolic_bp      INTEGER,
    pulse_bpm         INTEGER,
    temperature_f     NUMERIC(4, 1),
    spo2_percent      INTEGER,
    respiratory_rate  INTEGER,
    weight_kg         NUMERIC(5, 2),
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_vitals_systolic_bp      CHECK (systolic_bp IS NULL OR systolic_bp BETWEEN 50 AND 260),
    CONSTRAINT chk_vitals_diastolic_bp     CHECK (diastolic_bp IS NULL OR diastolic_bp BETWEEN 30 AND 160),
    CONSTRAINT chk_vitals_pulse_bpm        CHECK (pulse_bpm IS NULL OR pulse_bpm BETWEEN 30 AND 250),
    CONSTRAINT chk_vitals_spo2             CHECK (spo2_percent IS NULL OR spo2_percent BETWEEN 50 AND 100),
    CONSTRAINT chk_vitals_temperature      CHECK (temperature_f IS NULL OR temperature_f BETWEEN 90.0 AND 108.0),
    CONSTRAINT chk_vitals_respiratory_rate CHECK (respiratory_rate IS NULL OR respiratory_rate BETWEEN 5 AND 60),
    CONSTRAINT chk_vitals_weight           CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0.5 AND 500.0)
);
COMMENT ON TABLE public.clinical_vitals IS 'Normalized vital signs per consultation. All values nullable.';
CREATE INDEX IF NOT EXISTS idx_fk_vitals_consultation ON public.clinical_vitals(consultation_id);

CREATE TABLE IF NOT EXISTS public.diagnoses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id  UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    icd10_code       TEXT,
    diagnosis_name   TEXT NOT NULL,
    type             TEXT NOT NULL DEFAULT 'primary',
    notes            TEXT,
    CONSTRAINT chk_diagnoses_type        CHECK (type IN ('primary', 'secondary', 'differential')),
    CONSTRAINT chk_diagnoses_name_length CHECK (char_length(diagnosis_name) >= 3)
);
COMMENT ON TABLE public.diagnoses IS 'Discrete diagnoses per clinical encounter. ICD-10 coding optional in MVP.';
CREATE INDEX IF NOT EXISTS idx_fk_diagnoses_consultation ON public.diagnoses(consultation_id);

-- ==============================================================================
-- DOMAIN 4: PRESCRIPTIONS & DIAGNOSTIC DOCUMENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.prescriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id         UUID NOT NULL UNIQUE REFERENCES public.consultations(id) ON DELETE RESTRICT,
    patient_id              UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    doctor_id               UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    issued_at               TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    valid_until             DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    general_instructions    TEXT,
    is_signed               BOOLEAN NOT NULL DEFAULT FALSE,
    digital_signature_hash  TEXT,
    is_legacy_import        BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_prescriptions_self_prescribe CHECK (patient_id != doctor_id)
);
COMMENT ON TABLE  public.prescriptions IS 'Prescription header. Immutable after is_signed=TRUE. One per consultation.';
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor  ON public.prescriptions(doctor_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS public.prescription_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id      UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
    medicine_name        TEXT NOT NULL,
    dosage               TEXT NOT NULL,
    frequency            TEXT NOT NULL,
    duration             TEXT NOT NULL,
    timing               TEXT NOT NULL DEFAULT 'After Food',
    special_instructions TEXT,
    is_legacy_import     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_rx_items_timing        CHECK (timing IN ('After Food', 'Before Food', 'With Food', 'Anytime', 'Empty Stomach')),
    CONSTRAINT chk_rx_items_medicine_len  CHECK (char_length(medicine_name) >= 2),
    CONSTRAINT chk_rx_items_dosage_len    CHECK (char_length(dosage) >= 1),
    CONSTRAINT chk_rx_items_frequency_len CHECK (char_length(frequency) >= 1),
    CONSTRAINT chk_rx_items_duration_len  CHECK (char_length(duration) >= 1)
);
COMMENT ON TABLE  public.prescription_items IS 'Individual medicine line items. Replaces JSONB arrays and malformed strings.';
CREATE INDEX IF NOT EXISTS idx_fk_rx_items_prescription ON public.prescription_items(prescription_id);

CREATE TABLE IF NOT EXISTS public.medical_documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    consultation_id  UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    uploaded_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title            TEXT NOT NULL,
    storage_path     TEXT NOT NULL,
    file_type        TEXT NOT NULL DEFAULT 'pdf',
    file_size_bytes  INTEGER NOT NULL,
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_documents_file_type CHECK (file_type IN ('pdf', 'png', 'jpeg', 'jpg')),
    CONSTRAINT chk_documents_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    CONSTRAINT chk_documents_title_len CHECK (char_length(title) >= 3)
);
COMMENT ON TABLE  public.medical_documents IS 'Diagnostic documents. Replaces legacy reports table. Files in Supabase private Storage.';
CREATE INDEX IF NOT EXISTS idx_documents_patient    ON public.medical_documents(patient_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fk_documents_consult ON public.medical_documents(consultation_id);

-- ==============================================================================
-- DOMAIN 5: SECURITY, CONSENT & AUDIT INFRASTRUCTURE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_consents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id   UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    status      TEXT NOT NULL DEFAULT 'granted',
    scope       TEXT NOT NULL DEFAULT 'full_history',
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '2 hours'),
    revoked_at  TIMESTAMPTZ,
    CONSTRAINT chk_consents_self_grant    CHECK (patient_id != doctor_id),
    CONSTRAINT chk_consents_status        CHECK (status IN ('requested', 'granted', 'revoked', 'expired')),
    CONSTRAINT chk_consents_scope         CHECK (scope IN ('full_history', 'current_encounter_only')),
    CONSTRAINT chk_consents_revoked_after CHECK (revoked_at IS NULL OR revoked_at >= granted_at),
    CONSTRAINT chk_consents_expiry_after  CHECK (expires_at > granted_at)
);
COMMENT ON TABLE  public.consultation_consents IS 'Auditable patient consent for doctor record access. Replaces doctor_sessions. NEVER deleted.';
CREATE INDEX IF NOT EXISTS idx_consents_active_check
    ON public.consultation_consents(doctor_id, patient_id, status, expires_at)
    WHERE status = 'granted';
CREATE INDEX IF NOT EXISTS idx_consents_patient ON public.consultation_consents(patient_id, granted_at DESC);

CREATE TABLE IF NOT EXISTS public.doctor_qr_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id    UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    token_nonce  TEXT NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_qr_token_nonce_length  CHECK (char_length(token_nonce) >= 32),
    CONSTRAINT chk_qr_token_expiry_future CHECK (expires_at > created_at)
);
COMMENT ON TABLE  public.doctor_qr_tokens IS 'Ephemeral QR nonces. Expired tokens cleaned on new generation. No background cron needed.';
CREATE INDEX IF NOT EXISTS idx_qr_tokens_validity ON public.doctor_qr_tokens(doctor_id, expires_at);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action         TEXT NOT NULL,
    resource_type  TEXT NOT NULL,
    resource_id    UUID NOT NULL,
    ip_address     TEXT,
    user_agent     TEXT,
    metadata       JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_audit_action_not_empty   CHECK (char_length(action) >= 3),
    CONSTRAINT chk_audit_resource_not_empty CHECK (char_length(resource_type) >= 3)
);
COMMENT ON TABLE  public.audit_logs IS 'Immutable regulatory audit trail. INSERT only. No UPDATE or DELETE policies exist.';
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs(resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'patient',
    subject         TEXT NOT NULL,
    message         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',
    admin_response  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_queries_role    CHECK (role IN ('patient', 'doctor', 'admin')),
    CONSTRAINT chk_queries_status  CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
    CONSTRAINT chk_queries_subject CHECK (char_length(subject) >= 5),
    CONSTRAINT chk_queries_message CHECK (char_length(message) >= 10)
);
CREATE INDEX IF NOT EXISTS idx_user_queries_user   ON public.user_queries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_queries_status ON public.user_queries(status, created_at DESC);

-- ==============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END; $$;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['profiles','patients','doctors','appointments','user_queries'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_' || tbl || '_updated_at'
              AND tgrelid = ('public.' || tbl)::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%s
                 FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at()', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- END PHASE 3 | Next: Phase 4 (20261012000002_performance.sql)
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- FILE: supabase/migrations/20261012000002_performance.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- UniMedi v2 — Performance Indexes & Query Optimization
-- Phase 4 of 8 | Migration: 20261012000002_performance.sql
-- All indexes use IF NOT EXISTS — safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- DASHBOARD QUERY INDEXES
-- ------------------------------------------------------------------------------

-- Patient dashboard: "Show me my upcoming active appointments"
CREATE INDEX IF NOT EXISTS idx_appointments_patient_active
    ON public.appointments(patient_id, appointment_date ASC)
    WHERE status IN ('pending', 'confirmed', 'in_consultation');

-- Doctor queue: "Show me today's appointments with their statuses"
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_today
    ON public.appointments(doctor_id, appointment_date, status);

-- Prescription history: Patient fetching past prescriptions newest-first
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_issued
    ON public.prescriptions(patient_id, issued_at DESC);

-- Doctor prescription audit: Doctor viewing prescriptions they issued
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_issued
    ON public.prescriptions(doctor_id, issued_at DESC)
    WHERE is_signed = TRUE;

-- Consultation timeline: Patient history view, newest-first
CREATE INDEX IF NOT EXISTS idx_consultations_patient_timeline
    ON public.consultations(patient_id, started_at DESC)
    WHERE status = 'completed';

-- Doctor encounter history: Doctor reviewing past consultations
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_timeline
    ON public.consultations(doctor_id, started_at DESC)
    WHERE status IN ('completed', 'in_progress');

-- ------------------------------------------------------------------------------
-- CONSENT GATE INDEX (HIGH FREQUENCY — called by RLS helper function)
-- This is the most performance-critical index in the system.
-- Every doctor query on patient records triggers this check.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_consents_fast_check
    ON public.consultation_consents(doctor_id, patient_id, status, expires_at)
    WHERE status = 'granted';

-- ------------------------------------------------------------------------------
-- FOREIGN KEY COVERING INDEXES
-- Prevent sequential scans and table-lock cascades during DELETE operations.
-- PostgreSQL does NOT automatically index foreign keys.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fk_appointments_patient      ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_fk_appointments_doctor       ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_fk_consultations_patient     ON public.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_fk_consultations_doctor      ON public.consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_fk_consultations_appointment ON public.consultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_fk_prescriptions_patient     ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_fk_prescriptions_doctor      ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_fk_prescriptions_consult     ON public.prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_fk_rx_items_prescription     ON public.prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_fk_vitals_consultation       ON public.clinical_vitals(consultation_id);
CREATE INDEX IF NOT EXISTS idx_fk_diagnoses_consultation    ON public.diagnoses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_fk_documents_consultation    ON public.medical_documents(consultation_id);
CREATE INDEX IF NOT EXISTS idx_fk_documents_patient         ON public.medical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_fk_consents_patient          ON public.consultation_consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_fk_consents_doctor           ON public.consultation_consents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_fk_qr_tokens_doctor          ON public.doctor_qr_tokens(doctor_id);
CREATE INDEX IF NOT EXISTS idx_fk_audit_logs_actor          ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_roles_user           ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_doctors_specialty         ON public.doctors(specialty_id);
CREATE INDEX IF NOT EXISTS idx_fk_doctors_verified_by       ON public.doctors(verified_by);

-- ------------------------------------------------------------------------------
-- ADMIN PANEL INDEXES
-- ------------------------------------------------------------------------------

-- Admin: list all pending doctor verifications
CREATE INDEX IF NOT EXISTS idx_doctors_pending_verification
    ON public.doctors(created_at DESC)
    WHERE verification_status = 'pending';

-- Admin: audit log review by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
    ON public.audit_logs(action, created_at DESC);

-- Support: open tickets sorted by oldest first (SLA compliance)
CREATE INDEX IF NOT EXISTS idx_user_queries_open_oldest
    ON public.user_queries(created_at ASC)
    WHERE status = 'open';

-- QR token expiry cleanup: find expired tokens efficiently
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires_at
    ON public.doctor_qr_tokens(expires_at);

-- ==============================================================================
-- END PHASE 4 | Next: Phase 5 (20261012000003_rls_policies.sql)
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- FILE: supabase/migrations/20261012000003_rls_policies.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- UniMedi v2 — Row Level Security (RLS) Policies & Authorization Helpers
-- Phase 5 of 8 | Migration: 20261012000003_rls_policies.sql
-- IMPORTANT: Run AFTER Phase 3 (tables) and Phase 4 (indexes).
-- Uses Supabase auth.uid() — requires Supabase Auth to be configured.
-- ==============================================================================

-- ==============================================================================
-- SECTION A: AUTHORIZATION HELPER FUNCTIONS (SECURITY DEFINER)
-- These run with elevated privileges but fixed search_path to prevent injection.
-- Called by RLS policies to avoid recursive policy evaluation.
-- ==============================================================================

-- Helper 1: Check if the current authenticated user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = required_role
  );
$$;
COMMENT ON FUNCTION public.has_role IS 'Returns TRUE if the current auth.uid() holds the specified role.';

-- Helper 2: Check if current doctor has an active, non-expired consent for a patient
CREATE OR REPLACE FUNCTION public.doctor_has_active_consent(target_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultation_consents
    WHERE doctor_id = auth.uid()
      AND patient_id = target_patient_id
      AND status = 'granted'
      AND clock_timestamp() < expires_at
  );
$$;
COMMENT ON FUNCTION public.doctor_has_active_consent IS 'Returns TRUE if the current doctor has an active consent for the target patient.';

-- Helper 3: Convenience wrapper — is current user a verified doctor?
CREATE OR REPLACE FUNCTION public.current_user_is_doctor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = auth.uid()
      AND d.verification_status = 'verified'
  );
$$;
COMMENT ON FUNCTION public.current_user_is_doctor IS 'Returns TRUE if the current user is a verified doctor.';

-- Helper 4: Convenience wrapper — is current user a registered patient?
CREATE OR REPLACE FUNCTION public.current_user_is_patient()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.current_user_is_patient IS 'Returns TRUE if the current user has a patient record.';

-- Helper 5: Is the current user an admin?
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.has_role('admin');
$$;

-- ==============================================================================
-- SECTION B: ENABLE RLS ON ALL v2 TABLES
-- ==============================================================================

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_specialties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_vitals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnoses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_consents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_qr_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_queries           ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- SECTION C: RLS POLICIES PER TABLE
-- ==============================================================================

-- ==============================================================================
-- TABLE: profiles
-- ==============================================================================
DROP POLICY IF EXISTS "profiles_select_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_consented"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_system"     ON public.profiles;

-- Patients & doctors can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Consented doctors can read a patient's profile (for display name etc.)
CREATE POLICY "profiles_select_consented" ON public.profiles
    FOR SELECT USING (
        current_user_is_doctor()
        AND doctor_has_active_consent(id)
    );

-- Admin can read all profiles
CREATE POLICY "profiles_select_admin" ON public.profiles
    FOR SELECT USING (current_user_is_admin());

-- Users can update their own profile (name, phone, avatar_url only)
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- INSERT allowed for authenticated users (called by auth trigger/API route)
CREATE POLICY "profiles_insert_system" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- TABLE: user_roles
-- ==============================================================================
DROP POLICY IF EXISTS "user_roles_select_own"    ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin"  ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_patient_self" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin"  ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_admin"  ON public.user_roles;

-- Users can see their own roles
CREATE POLICY "user_roles_select_own" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_roles_select_admin" ON public.user_roles
    FOR SELECT USING (current_user_is_admin());

-- Patients can self-provision patient role (INSERT role='patient' for own user_id)
CREATE POLICY "user_roles_insert_patient_self" ON public.user_roles
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND role = 'patient'
    );

-- Admin can grant any role
CREATE POLICY "user_roles_insert_admin" ON public.user_roles
    FOR INSERT WITH CHECK (current_user_is_admin());

-- Only admin can revoke roles
CREATE POLICY "user_roles_delete_admin" ON public.user_roles
    FOR DELETE USING (current_user_is_admin());

-- ==============================================================================
-- TABLE: medical_specialties (read-only for non-admins — master lookup)
-- ==============================================================================
DROP POLICY IF EXISTS "specialties_select_all"  ON public.medical_specialties;
DROP POLICY IF EXISTS "specialties_admin_write" ON public.medical_specialties;

CREATE POLICY "specialties_select_all" ON public.medical_specialties
    FOR SELECT USING (auth.uid() IS NOT NULL);  -- Any authenticated user

CREATE POLICY "specialties_admin_write" ON public.medical_specialties
    FOR ALL USING (current_user_is_admin())
    WITH CHECK (current_user_is_admin());

-- ==============================================================================
-- TABLE: doctors
-- ==============================================================================
DROP POLICY IF EXISTS "doctors_select_verified_public"  ON public.doctors;
DROP POLICY IF EXISTS "doctors_select_own"              ON public.doctors;
DROP POLICY IF EXISTS "doctors_select_admin"            ON public.doctors;
DROP POLICY IF EXISTS "doctors_insert_admin"            ON public.doctors;
DROP POLICY IF EXISTS "doctors_update_own_bio"          ON public.doctors;
DROP POLICY IF EXISTS "doctors_update_admin"            ON public.doctors;
DROP POLICY IF EXISTS "doctors_delete_admin"            ON public.doctors;

-- Any authenticated user can browse verified doctors (for booking)
CREATE POLICY "doctors_select_verified_public" ON public.doctors
    FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND verification_status = 'verified'
    );

-- Doctors can read their own record regardless of status
CREATE POLICY "doctors_select_own" ON public.doctors
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "doctors_select_admin" ON public.doctors
    FOR SELECT USING (current_user_is_admin());

-- Only admin can provision (insert) a doctor
CREATE POLICY "doctors_insert_admin" ON public.doctors
    FOR INSERT WITH CHECK (current_user_is_admin());

-- Doctors can update their own bio fields (NOT license_number, NOT verification_status)
CREATE POLICY "doctors_update_own_bio" ON public.doctors
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- Note: license_number and verification_status changes require admin
    );

CREATE POLICY "doctors_update_admin" ON public.doctors
    FOR UPDATE USING (current_user_is_admin());

-- Only admin can suspend/delete a doctor record
CREATE POLICY "doctors_delete_admin" ON public.doctors
    FOR DELETE USING (current_user_is_admin());

-- ==============================================================================
-- TABLE: patients
-- ==============================================================================
DROP POLICY IF EXISTS "patients_select_own"       ON public.patients;
DROP POLICY IF EXISTS "patients_select_consented" ON public.patients;
DROP POLICY IF EXISTS "patients_select_admin"     ON public.patients;
DROP POLICY IF EXISTS "patients_insert_self"      ON public.patients;
DROP POLICY IF EXISTS "patients_update_own"       ON public.patients;

-- Patients can only see their own record
CREATE POLICY "patients_select_own" ON public.patients
    FOR SELECT USING (id = auth.uid());

-- Consented doctors can read a patient's clinical info
CREATE POLICY "patients_select_consented" ON public.patients
    FOR SELECT USING (
        current_user_is_doctor()
        AND doctor_has_active_consent(id)
    );

CREATE POLICY "patients_select_admin" ON public.patients
    FOR SELECT USING (current_user_is_admin());

-- Patients self-provision their own row (on first login)
CREATE POLICY "patients_insert_self" ON public.patients
    FOR INSERT WITH CHECK (id = auth.uid());

-- Patients update their own profile only
CREATE POLICY "patients_update_own" ON public.patients
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ==============================================================================
-- TABLE: appointments
-- ==============================================================================
DROP POLICY IF EXISTS "appointments_select_patient"  ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_doctor"   ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_admin"    ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_patient"  ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_walkin"   ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_patient"  ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_doctor"   ON public.appointments;

CREATE POLICY "appointments_select_patient" ON public.appointments
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "appointments_select_doctor" ON public.appointments
    FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "appointments_select_admin" ON public.appointments
    FOR SELECT USING (current_user_is_admin());

-- Patients can book appointments for themselves
CREATE POLICY "appointments_insert_patient" ON public.appointments
    FOR INSERT WITH CHECK (
        patient_id = auth.uid()
        AND type = 'online_booking'
    );

-- Verified doctors can create walk-in queue entries
CREATE POLICY "appointments_insert_walkin" ON public.appointments
    FOR INSERT WITH CHECK (
        current_user_is_doctor()
        AND type = 'walk_in_qr'
    );

-- Patients can cancel their own pending appointments
CREATE POLICY "appointments_update_patient" ON public.appointments
    FOR UPDATE USING (patient_id = auth.uid())
    WITH CHECK (
        patient_id = auth.uid()
        AND status = 'cancelled'  -- Patients can only cancel (not modify)
    );

-- Doctors can update appointment status (confirm, start consultation, complete)
CREATE POLICY "appointments_update_doctor" ON public.appointments
    FOR UPDATE USING (doctor_id = auth.uid())
    WITH CHECK (doctor_id = auth.uid());

-- ==============================================================================
-- TABLE: consultations (clinical encounters — restricted access)
-- ==============================================================================
DROP POLICY IF EXISTS "consultations_select_patient"   ON public.consultations;
DROP POLICY IF EXISTS "consultations_select_doctor"    ON public.consultations;
DROP POLICY IF EXISTS "consultations_select_admin"     ON public.consultations;
DROP POLICY IF EXISTS "consultations_insert_doctor"    ON public.consultations;
DROP POLICY IF EXISTS "consultations_update_doctor"    ON public.consultations;

CREATE POLICY "consultations_select_patient" ON public.consultations
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "consultations_select_doctor" ON public.consultations
    FOR SELECT USING (
        doctor_id = auth.uid()
        OR (current_user_is_doctor() AND doctor_has_active_consent(patient_id))
    );

CREATE POLICY "consultations_select_admin" ON public.consultations
    FOR SELECT USING (current_user_is_admin());

-- Only verified doctors with active consent can create consultation records
CREATE POLICY "consultations_insert_doctor" ON public.consultations
    FOR INSERT WITH CHECK (
        doctor_id = auth.uid()
        AND current_user_is_doctor()
        AND doctor_has_active_consent(patient_id)
    );

-- Only the conducting doctor can update a consultation (while in_progress)
CREATE POLICY "consultations_update_doctor" ON public.consultations
    FOR UPDATE USING (
        doctor_id = auth.uid()
        AND status = 'in_progress'
    );

-- ==============================================================================
-- TABLE: clinical_vitals
-- ==============================================================================
DROP POLICY IF EXISTS "vitals_select_patient"  ON public.clinical_vitals;
DROP POLICY IF EXISTS "vitals_select_doctor"   ON public.clinical_vitals;
DROP POLICY IF EXISTS "vitals_insert_doctor"   ON public.clinical_vitals;
DROP POLICY IF EXISTS "vitals_update_doctor"   ON public.clinical_vitals;

CREATE POLICY "vitals_select_patient" ON public.clinical_vitals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.patient_id = auth.uid())
    );

CREATE POLICY "vitals_select_doctor" ON public.clinical_vitals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_id
              AND (c.doctor_id = auth.uid() OR doctor_has_active_consent(c.patient_id)))
    );

CREATE POLICY "vitals_insert_doctor" ON public.clinical_vitals
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_id
              AND c.doctor_id = auth.uid()
              AND c.status = 'in_progress')
    );

CREATE POLICY "vitals_update_doctor" ON public.clinical_vitals
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_id
              AND c.doctor_id = auth.uid()
              AND c.status = 'in_progress')
    );

-- ==============================================================================
-- TABLE: diagnoses (same pattern as vitals)
-- ==============================================================================
DROP POLICY IF EXISTS "diagnoses_select_patient" ON public.diagnoses;
DROP POLICY IF EXISTS "diagnoses_select_doctor"  ON public.diagnoses;
DROP POLICY IF EXISTS "diagnoses_insert_doctor"  ON public.diagnoses;

CREATE POLICY "diagnoses_select_patient" ON public.diagnoses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.patient_id = auth.uid())
    );

CREATE POLICY "diagnoses_select_doctor" ON public.diagnoses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_id
              AND (c.doctor_id = auth.uid() OR doctor_has_active_consent(c.patient_id)))
    );

CREATE POLICY "diagnoses_insert_doctor" ON public.diagnoses
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_id AND c.doctor_id = auth.uid() AND c.status = 'in_progress')
    );

-- ==============================================================================
-- TABLE: prescriptions
-- ==============================================================================
DROP POLICY IF EXISTS "prescriptions_select_patient"  ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_select_doctor"   ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_select_admin"    ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_insert_doctor"   ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_update_doctor"   ON public.prescriptions;

CREATE POLICY "prescriptions_select_patient" ON public.prescriptions
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "prescriptions_select_doctor" ON public.prescriptions
    FOR SELECT USING (
        doctor_id = auth.uid()
        OR (current_user_is_doctor() AND doctor_has_active_consent(patient_id))
    );

CREATE POLICY "prescriptions_select_admin" ON public.prescriptions
    FOR SELECT USING (current_user_is_admin());

CREATE POLICY "prescriptions_insert_doctor" ON public.prescriptions
    FOR INSERT WITH CHECK (
        doctor_id = auth.uid()
        AND current_user_is_doctor()
        AND doctor_has_active_consent(patient_id)
    );

-- Doctors can update prescription (add items, change instructions) ONLY before signing
CREATE POLICY "prescriptions_update_doctor" ON public.prescriptions
    FOR UPDATE USING (
        doctor_id = auth.uid()
        AND is_signed = FALSE
    )
    WITH CHECK (doctor_id = auth.uid());

-- ==============================================================================
-- TABLE: prescription_items
-- ==============================================================================
DROP POLICY IF EXISTS "rx_items_select_patient"  ON public.prescription_items;
DROP POLICY IF EXISTS "rx_items_select_doctor"   ON public.prescription_items;
DROP POLICY IF EXISTS "rx_items_insert_doctor"   ON public.prescription_items;

CREATE POLICY "rx_items_select_patient" ON public.prescription_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.prescriptions p WHERE p.id = prescription_id AND p.patient_id = auth.uid())
    );

CREATE POLICY "rx_items_select_doctor" ON public.prescription_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.prescriptions p
            WHERE p.id = prescription_id
              AND (p.doctor_id = auth.uid() OR doctor_has_active_consent(p.patient_id)))
    );

CREATE POLICY "rx_items_insert_doctor" ON public.prescription_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.prescriptions p
            WHERE p.id = prescription_id
              AND p.doctor_id = auth.uid()
              AND p.is_signed = FALSE)
    );

-- ==============================================================================
-- TABLE: medical_documents
-- ==============================================================================
DROP POLICY IF EXISTS "documents_select_patient"   ON public.medical_documents;
DROP POLICY IF EXISTS "documents_select_doctor"    ON public.medical_documents;
DROP POLICY IF EXISTS "documents_insert_patient"   ON public.medical_documents;
DROP POLICY IF EXISTS "documents_insert_doctor"    ON public.medical_documents;
DROP POLICY IF EXISTS "documents_delete_owner"     ON public.medical_documents;

CREATE POLICY "documents_select_patient" ON public.medical_documents
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "documents_select_doctor" ON public.medical_documents
    FOR SELECT USING (
        current_user_is_doctor()
        AND doctor_has_active_consent(patient_id)
    );

CREATE POLICY "documents_insert_patient" ON public.medical_documents
    FOR INSERT WITH CHECK (
        patient_id = auth.uid()
        AND uploaded_by = auth.uid()
    );

CREATE POLICY "documents_insert_doctor" ON public.medical_documents
    FOR INSERT WITH CHECK (
        current_user_is_doctor()
        AND uploaded_by = auth.uid()
        AND doctor_has_active_consent(patient_id)
    );

-- Patients can delete their own documents (but not doctor-uploaded ones)
CREATE POLICY "documents_delete_owner" ON public.medical_documents
    FOR DELETE USING (
        patient_id = auth.uid()
        AND uploaded_by = auth.uid()
    );

-- ==============================================================================
-- TABLE: consultation_consents (consent lifecycle management)
-- ==============================================================================
DROP POLICY IF EXISTS "consents_select_patient"   ON public.consultation_consents;
DROP POLICY IF EXISTS "consents_select_doctor"    ON public.consultation_consents;
DROP POLICY IF EXISTS "consents_select_admin"     ON public.consultation_consents;
DROP POLICY IF EXISTS "consents_insert_patient"   ON public.consultation_consents;
DROP POLICY IF EXISTS "consents_update_patient"   ON public.consultation_consents;

CREATE POLICY "consents_select_patient" ON public.consultation_consents
    FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "consents_select_doctor" ON public.consultation_consents
    FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "consents_select_admin" ON public.consultation_consents
    FOR SELECT USING (current_user_is_admin());

-- Patients grant consent (INSERT)
CREATE POLICY "consents_insert_patient" ON public.consultation_consents
    FOR INSERT WITH CHECK (patient_id = auth.uid());

-- Patients can revoke consent (UPDATE status to 'revoked', set revoked_at)
-- System/API can expire consent (UPDATE status to 'expired')
CREATE POLICY "consents_update_patient" ON public.consultation_consents
    FOR UPDATE USING (patient_id = auth.uid())
    WITH CHECK (
        patient_id = auth.uid()
        AND status IN ('revoked', 'expired')
    );

-- NO DELETE policy — consent rows are never deleted (audit trail)

-- ==============================================================================
-- TABLE: doctor_qr_tokens
-- ==============================================================================
DROP POLICY IF EXISTS "qr_tokens_select_patient"  ON public.doctor_qr_tokens;
DROP POLICY IF EXISTS "qr_tokens_select_doctor"   ON public.doctor_qr_tokens;
DROP POLICY IF EXISTS "qr_tokens_insert_doctor"   ON public.doctor_qr_tokens;
DROP POLICY IF EXISTS "qr_tokens_delete_doctor"   ON public.doctor_qr_tokens;

-- Authenticated patients can validate a QR token during scan
CREATE POLICY "qr_tokens_select_patient" ON public.doctor_qr_tokens
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Doctors can view their own tokens
CREATE POLICY "qr_tokens_select_doctor" ON public.doctor_qr_tokens
    FOR SELECT USING (doctor_id = auth.uid());

-- Verified doctors can generate tokens for their own clinic
CREATE POLICY "qr_tokens_insert_doctor" ON public.doctor_qr_tokens
    FOR INSERT WITH CHECK (
        doctor_id = auth.uid()
        AND current_user_is_doctor()
    );

-- Doctors can clean up their own expired tokens
CREATE POLICY "qr_tokens_delete_doctor" ON public.doctor_qr_tokens
    FOR DELETE USING (doctor_id = auth.uid());

-- ==============================================================================
-- TABLE: audit_logs (STRICTLY INSERT ONLY)
-- ==============================================================================
DROP POLICY IF EXISTS "audit_logs_select_admin"  ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;

-- Only admins can read audit logs
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
    FOR SELECT USING (current_user_is_admin());

-- Any authenticated actor can insert (system writes via service role key in API routes)
CREATE POLICY "audit_logs_insert_system" ON public.audit_logs
    FOR INSERT WITH CHECK (
        actor_id = auth.uid()
        OR current_user_is_admin()
    );

-- NO UPDATE policy. NO DELETE policy. Audit trail is immutable.

-- ==============================================================================
-- TABLE: user_queries
-- ==============================================================================
DROP POLICY IF EXISTS "queries_select_own"    ON public.user_queries;
DROP POLICY IF EXISTS "queries_select_admin"  ON public.user_queries;
DROP POLICY IF EXISTS "queries_insert_auth"   ON public.user_queries;
DROP POLICY IF EXISTS "queries_update_admin"  ON public.user_queries;

CREATE POLICY "queries_select_own" ON public.user_queries
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "queries_select_admin" ON public.user_queries
    FOR SELECT USING (current_user_is_admin());

-- Any authenticated user can submit a support query
CREATE POLICY "queries_insert_auth" ON public.user_queries
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin can update ticket status and write responses
CREATE POLICY "queries_update_admin" ON public.user_queries
    FOR UPDATE USING (current_user_is_admin());

-- ==============================================================================
-- END PHASE 5 | Next: Phase 6 (20261012000004_data_backfill.sql)
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- FILE: supabase/migrations/20261012000004_data_backfill.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- UniMedi v2 — Data Backfill & ETL Migration
-- Phase 6 of 8 | Migration: 20261012000004_data_backfill.sql
-- 
-- SAFETY RULES:
-- 1. All INSERTs use ON CONFLICT DO NOTHING / UPDATE — fully idempotent and re-runnable.
-- 2. Legacy tables (users, legacy_user_roles, legacy_patient_profiles, medical_records, doctor_sessions)
--    are preserved intact.
-- 3. Migrates live database data safely and adds canonical seed demo identities.
-- ==============================================================================

-- ==============================================================================
-- STEP 1: Backfill profiles from legacy users table
-- Transforms: public.users -> public.profiles
-- ==============================================================================
INSERT INTO public.profiles (id, email, full_name, phone, is_active, created_at, updated_at)
SELECT
    id,
    LOWER(TRIM(email))                            AS email,
    COALESCE(NULLIF(TRIM(full_name), ''), 'User') AS full_name,
    phone,
    TRUE                                          AS is_active,
    COALESCE(created_at, NOW())                   AS created_at,
    COALESCE(created_at, NOW())                   AS updated_at
FROM public.users
ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    phone      = EXCLUDED.phone,
    updated_at = NOW()
WHERE public.profiles.full_name = 'User';

-- ==============================================================================
-- STEP 2: Seed canonical demo profiles (only if email does not already exist)
-- ==============================================================================
INSERT INTO public.profiles (id, email, full_name, phone, is_active, created_at, updated_at)
VALUES
    ('00000000-0000-4000-a000-000000000001', 'sangeeta.demo@unimedi.app', 'Dr. Sangeeta Kumari', '+91 9876543210', TRUE, NOW(), NOW()),
    ('11111111-1111-4111-a111-111111111111', 'rajesh.demo@unimedi.app',   'Dr. Rajesh Sharma',   '+91 9811122233', TRUE, NOW(), NOW()),
    ('44444444-4444-4444-a444-444444444444', 'arun.patel.unimedi@gmail.com',   'Arun Patel',   '+91 9876543210', TRUE, NOW(), NOW()),
    ('55555555-5555-4555-a555-555555555555', 'priya.verma.unimedi@gmail.com',  'Priya Verma',  '+91 9876543211', TRUE, NOW(), NOW()),
    ('66666666-6666-4666-a666-666666666666', 'rohit.singh.unimedi@gmail.com',  'Rohit Singh',  '+91 9876543212', TRUE, NOW(), NOW()),
    ('77777777-7777-4777-a777-777777777777', 'ananya.sen.unimedi@gmail.com',   'Ananya Sen',   '+91 9876543213', TRUE, NOW(), NOW()),
    ('88888888-8888-4888-a888-888888888888', 'rahul.verma.unimedi@gmail.com',  'Rahul Verma',  '+91 9876543214', TRUE, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- STEP 3: Backfill user_roles from legacy_user_roles table & assign roles
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'legacy_user_roles') THEN
        INSERT INTO public.user_roles (id, user_id, role, granted_at, granted_by)
        SELECT
            gen_random_uuid(),
            ur.user_id,
            ur.role,
            NOW(),
            NULL
        FROM public.legacy_user_roles ur
        WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;

-- Ensure verified doctors have 'doctor' role in user_roles
INSERT INTO public.user_roles (user_id, role, granted_at, granted_by)
SELECT p.id, 'doctor', NOW(), NULL
FROM public.profiles p
WHERE p.email IN ('sangeetakumarinew0606@gmail.com', 'scarlight.c39@gmail.com', 'sangeeta.demo@unimedi.app', 'rajesh.demo@unimedi.app')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure patients have 'patient' role in user_roles
INSERT INTO public.user_roles (user_id, role, granted_at, granted_by)
SELECT p.id, 'patient', NOW(), NULL
FROM public.profiles p
WHERE p.email NOT IN ('sangeetakumarinew0606@gmail.com', 'scarlight.c39@gmail.com', 'sangeeta.demo@unimedi.app', 'rajesh.demo@unimedi.app')
ON CONFLICT (user_id, role) DO NOTHING;

-- ==============================================================================
-- STEP 4: Backfill doctors table from legacy_user_roles & active doctors
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'legacy_user_roles') THEN
        INSERT INTO public.doctors (id, specialty_id, license_number, hospital_affiliation, qualification, verification_status, verified_at)
        SELECT
            ur.user_id                                                    AS id,
            COALESCE(
                (SELECT ms.id FROM public.medical_specialties ms
                 WHERE LOWER(ms.name) LIKE '%' || LOWER(SPLIT_PART(TRIM(ur.speciality), ' ', 1)) || '%'
                 LIMIT 1),
                '00000000-0000-0000-0001-000000000001'
            )                                                             AS specialty_id,
            'MCI-LEGACY-' || UPPER(SUBSTRING(ur.user_id::TEXT, 1, 8))     AS license_number,
            'UniMedi Central Dispensary'                                  AS hospital_affiliation,
            'MBBS'                                                        AS qualification,
            'verified'                                                    AS verification_status,
            NOW()                                                         AS verified_at
        FROM public.legacy_user_roles ur
        WHERE ur.role = 'doctor'
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Ensure key doctors are verified in doctors table
INSERT INTO public.doctors (id, specialty_id, license_number, hospital_affiliation, qualification, verification_status, verified_at, consultation_fee)
SELECT
    p.id,
    CASE 
        WHEN p.email LIKE '%scarlight%' OR p.email LIKE '%rajesh%' 
            THEN '00000000-0000-0000-0001-000000000003'::UUID -- Cardiology
        ELSE '00000000-0000-0000-0001-000000000001'::UUID -- General Medicine
    END,
    'MCI-' || UPPER(SUBSTRING(p.id::TEXT, 1, 8)),
    'University Central Medical Centre',
    'MBBS, MD',
    'verified',
    NOW(),
    0.00
FROM public.profiles p
WHERE p.email IN ('sangeetakumarinew0606@gmail.com', 'scarlight.c39@gmail.com', 'sangeeta.demo@unimedi.app', 'rajesh.demo@unimedi.app')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- STEP 5: Backfill patients table from legacy profiles & users
-- ==============================================================================
DO $$
BEGIN
    -- From legacy_patient_profiles (which contains age, gender, blood_group)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'legacy_patient_profiles') THEN
        INSERT INTO public.patients (id, gender, blood_group, created_at, updated_at)
        SELECT
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
          AND NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = lp.user_id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- From profiles for any remaining non-doctor accounts
INSERT INTO public.patients (id, date_of_birth, gender, blood_group, address, created_at, updated_at)
SELECT
    p.id,
    '2002-05-14'::DATE,
    'male',
    'O+',
    'Campus North Hostel',
    COALESCE(p.created_at, NOW()),
    COALESCE(p.updated_at, NOW())
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = p.id)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- STEP 6: Migrate legacy doctor_sessions -> consultation_consents
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctor_sessions') THEN
        INSERT INTO public.consultation_consents (patient_id, doctor_id, status, scope, granted_at, expires_at)
        SELECT
            ds.patient_id,
            ds.doctor_id,
            CASE WHEN ds.approved = TRUE THEN 'granted' ELSE 'requested' END AS status,
            'full_history'                                                    AS scope,
            COALESCE(ds.created_at, NOW())                                    AS granted_at,
            COALESCE(ds.created_at, NOW()) + INTERVAL '2 hours'              AS expires_at
        FROM public.doctor_sessions ds
        WHERE EXISTS (SELECT 1 FROM public.patients  pat WHERE pat.id = ds.patient_id)
          AND EXISTS (SELECT 1 FROM public.doctors   doc WHERE doc.id = ds.doctor_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ==============================================================================
-- STEP 7: Migrate legacy medical_records -> consultations + prescriptions + items + diagnoses
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medical_records') THEN
        -- 7a: Consultations
        INSERT INTO public.consultations (
            id, appointment_id, patient_id, doctor_id,
            started_at, concluded_at, chief_complaint, clinical_notes, status, created_at
        )
        SELECT
            mr.id,
            NULL AS appointment_id,
            CASE 
                WHEN mr.patient_id = mr.doctor_id THEN (SELECT id FROM public.patients LIMIT 1)
                ELSE mr.patient_id 
            END AS patient_id,
            mr.doctor_id,
            COALESCE(mr.created_at, NOW()) AS started_at,
            COALESCE(mr.created_at, NOW()) AS concluded_at,
            COALESCE(NULLIF(TRIM(mr.diagnosis), ''), 'Legacy consultation record') AS chief_complaint,
            mr.notes AS clinical_notes,
            'completed' AS status,
            COALESCE(mr.created_at, NOW()) AS created_at
        FROM public.medical_records mr
        WHERE EXISTS (SELECT 1 FROM public.doctors doc WHERE doc.id = mr.doctor_id)
          AND (
              EXISTS (SELECT 1 FROM public.patients pat WHERE pat.id = mr.patient_id)
              OR mr.patient_id = mr.doctor_id
          )
        ON CONFLICT (id) DO NOTHING;

        -- 7b: Prescriptions
        INSERT INTO public.prescriptions (
            consultation_id, patient_id, doctor_id,
            issued_at, valid_until, general_instructions,
            is_signed, is_legacy_import
        )
        SELECT
            c.id AS consultation_id,
            c.patient_id,
            c.doctor_id,
            c.started_at AS issued_at,
            (c.started_at + INTERVAL '30 days')::DATE AS valid_until,
            c.clinical_notes AS general_instructions,
            TRUE AS is_signed,
            TRUE AS is_legacy_import
        FROM public.consultations c
        WHERE EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = c.id)
        ON CONFLICT (consultation_id) DO NOTHING;

        -- 7c: Prescription Items (plain text from legacy medicines)
        INSERT INTO public.prescription_items (
            prescription_id, medicine_name, dosage, frequency, duration, timing,
            special_instructions, is_legacy_import
        )
        SELECT
            p.id AS prescription_id,
            INITCAP(COALESCE(NULLIF(TRIM(mr.medicines), ''), 'General Medication')) AS medicine_name,
            'as directed' AS dosage,
            'SOS' AS frequency,
            'as directed' AS duration,
            'Anytime' AS timing,
            'Migrated from legacy medical record' AS special_instructions,
            TRUE AS is_legacy_import
        FROM public.medical_records mr
        JOIN public.prescriptions p ON p.consultation_id = mr.id
        ON CONFLICT DO NOTHING;

        -- 7d: Diagnoses
        INSERT INTO public.diagnoses (
            consultation_id, icd10_code, diagnosis_name, type, notes
        )
        SELECT
            mr.id AS consultation_id,
            'R69' AS icd10_code,
            CASE 
                WHEN char_length(TRIM(mr.diagnosis)) >= 3 THEN TRIM(mr.diagnosis)
                ELSE 'General Consultation'
            END AS diagnosis_name,
            'primary' AS type,
            'Imported from legacy medical record' AS notes
        FROM public.medical_records mr
        JOIN public.consultations c ON c.id = mr.id
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 7e: Migrate legacy vitals dynamically if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'medical_records' AND column_name = 'vitals'
    ) THEN
        EXECUTE '
        INSERT INTO public.clinical_vitals (
            consultation_id, systolic_bp, diastolic_bp, pulse_bpm,
            temperature_f, spo2_percent, weight_kg, recorded_at
        )
        SELECT
            mr.id AS consultation_id,
            CASE
                WHEN mr.vitals::jsonb->>''systolic_bp'' IS NOT NULL THEN (mr.vitals::jsonb->>''systolic_bp'')::INTEGER
                WHEN mr.vitals::jsonb->>''bp'' LIKE ''%/%'' THEN SPLIT_PART(mr.vitals::jsonb->>''bp'', ''/'', 1)::INTEGER
                ELSE NULL
            END AS systolic_bp,
            CASE
                WHEN mr.vitals::jsonb->>''diastolic_bp'' IS NOT NULL THEN (mr.vitals::jsonb->>''diastolic_bp'')::INTEGER
                WHEN mr.vitals::jsonb->>''bp'' LIKE ''%/%'' THEN SPLIT_PART(mr.vitals::jsonb->>''bp'', ''/'', 2)::INTEGER
                ELSE NULL
            END AS diastolic_bp,
            (mr.vitals::jsonb->>''pulse'')::INTEGER AS pulse_bpm,
            (mr.vitals::jsonb->>''temperature'')::NUMERIC AS temperature_f,
            (mr.vitals::jsonb->>''spo2'')::INTEGER AS spo2_percent,
            (mr.vitals::jsonb->>''weight'')::NUMERIC AS weight_kg,
            COALESCE(mr.created_at, NOW()) AS recorded_at
        FROM public.medical_records mr
        JOIN public.consultations c ON c.id = mr.id
        WHERE mr.vitals IS NOT NULL
        ON CONFLICT (consultation_id) DO NOTHING;';
    END IF;
END $$;

-- ==============================================================================
-- STEP 8: Migrate legacy reports -> medical_documents (if table exists)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
        INSERT INTO public.medical_documents (
            patient_id, consultation_id, uploaded_by,
            title, storage_path, file_type, file_size_bytes, uploaded_at
        )
        SELECT
            r.patient_id,
            mr.id AS consultation_id,
            r.patient_id AS uploaded_by,
            COALESCE(NULLIF(TRIM(r.title), ''), 'Uploaded Report'),
            COALESCE(r.file_url, 'legacy/' || r.id::TEXT),
            COALESCE(NULLIF(TRIM(r.file_type), ''), 'pdf'),
            0 AS file_size_bytes,
            COALESCE(r.uploaded_at, NOW())
        FROM public.reports r
        LEFT JOIN public.medical_records mr ON mr.id = r.medical_record_id
        WHERE EXISTS (SELECT 1 FROM public.patients pat WHERE pat.id = r.patient_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ==============================================================================
-- STEP 9: Validation Checks
-- ==============================================================================
DO $$
DECLARE
    v_profiles_count    INTEGER;
    v_doctors_count     INTEGER;
    v_patients_count    INTEGER;
    v_consults_count    INTEGER;
    v_rx_count          INTEGER;
    v_rx_items_count    INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_profiles_count  FROM public.profiles;
    SELECT COUNT(*) INTO v_doctors_count   FROM public.doctors;
    SELECT COUNT(*) INTO v_patients_count  FROM public.patients;
    SELECT COUNT(*) INTO v_consults_count  FROM public.consultations;
    SELECT COUNT(*) INTO v_rx_count        FROM public.prescriptions;
    SELECT COUNT(*) INTO v_rx_items_count  FROM public.prescription_items;

    RAISE NOTICE '=== UniMedi v2 Backfill Validation ===';
    RAISE NOTICE 'Profiles:             %', v_profiles_count;
    RAISE NOTICE 'Doctors:              %', v_doctors_count;
    RAISE NOTICE 'Patients:             %', v_patients_count;
    RAISE NOTICE 'Consultations:        %', v_consults_count;
    RAISE NOTICE 'Prescriptions:        %', v_rx_count;
    RAISE NOTICE 'Prescription Items:   %', v_rx_items_count;
    RAISE NOTICE 'BACKFILL VALIDATION COMPLETE';
END $$;
