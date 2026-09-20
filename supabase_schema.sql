-- ==============================================================================
-- UniMedi Database Schema
-- Supabase PostgreSQL Migration Script
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT,
    blood_group TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    speciality TEXT, -- Applicable for doctors
    license_number TEXT, -- Applicable for doctors
    hospital_affiliation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Doctor Sessions Table (QR-based active consultation connections)
CREATE TABLE IF NOT EXISTS public.doctor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Appointments Table (Dual-Mode: Online Slot Booking & Walk-in QR Queue)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'online_booking' CHECK (type IN ('online_booking', 'walk_in_qr')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_consultation', 'completed', 'cancelled')),
    reason_for_visit TEXT,
    doctor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Medical Records / Structured Prescriptions Table
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    diagnosis TEXT NOT NULL,
    medicines JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of { name, dosage, frequency, duration, timing, instructions }
    notes TEXT,
    vitals JSONB DEFAULT '{}'::JSONB, -- { bp, pulse, temperature, weight }
    lab_tests JSONB DEFAULT '[]'::JSONB, -- Array of { test_name, result, reference_range, notes }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Reports / Uploaded Medical Files Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT DEFAULT 'pdf',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. User Queries / Support Helpdesk Table
CREATE TABLE IF NOT EXISTS public.user_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'patient',
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved')),
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_sessions_doctor ON public.doctor_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_sessions_patient ON public.doctor_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor ON public.medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON public.reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_user_queries_status ON public.user_queries(status);

-- 10. Row Level Security (RLS) Enablement
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_queries ENABLE ROW LEVEL SECURITY;

-- 11. Open Access Policies (for anon/public key usage in Next.js client)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access users' AND tablename = 'users') THEN
        CREATE POLICY "Allow public access users" ON public.users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access user_roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Allow public access user_roles" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access doctor_sessions' AND tablename = 'doctor_sessions') THEN
        CREATE POLICY "Allow public access doctor_sessions" ON public.doctor_sessions FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access appointments' AND tablename = 'appointments') THEN
        CREATE POLICY "Allow public access appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access medical_records' AND tablename = 'medical_records') THEN
        CREATE POLICY "Allow public access medical_records" ON public.medical_records FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access reports' AND tablename = 'reports') THEN
        CREATE POLICY "Allow public access reports" ON public.reports FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access user_queries' AND tablename = 'user_queries') THEN
        CREATE POLICY "Allow public access user_queries" ON public.user_queries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

