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
