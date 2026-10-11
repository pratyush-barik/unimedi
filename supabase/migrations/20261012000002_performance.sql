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
