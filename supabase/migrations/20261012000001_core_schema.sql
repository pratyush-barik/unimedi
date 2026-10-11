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
