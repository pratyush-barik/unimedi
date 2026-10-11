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
