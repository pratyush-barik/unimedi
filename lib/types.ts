export type MedicineItem = {
  name: string;
  dosage: string;
  frequency: string; // e.g. "1-0-1", "1-0-0", "0-0-1", "1-1-1", "As Needed"
  duration: string; // e.g. "5 days", "10 days", "1 month"
  timing: "After Food" | "Before Food" | "With Food" | "Anytime";
  instructions?: string;
};

export type Vitals = {
  bp?: string;
  pulse?: string;
  temperature?: string;
  weight?: string;
  spo2?: string;
  respiratory_rate?: string;
};

export type LabTest = {
  test_name: string;
  result: string;
  reference_range?: string;
  notes?: string;
};

export type AppointmentType = "online_booking" | "walk_in_qr";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_consultation"
  | "completed"
  | "cancelled";

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  time_slot: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit?: string;
  doctor_notes?: string;
  created_at: string;
  doctor?: {
    full_name: string;
    email: string;
    speciality?: string;
    hospital_affiliation?: string;
  };
  patient?: {
    full_name: string;
    email: string;
    phone?: string;
    blood_group?: string;
    gender?: string;
    date_of_birth?: string;
  };
};

export type MedicalRecord = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  diagnosis: string;
  medicines: MedicineItem[] | string;
  notes?: string;
  vitals?: Vitals | Record<string, any>;
  lab_tests?: LabTest[] | Record<string, any>[];
  created_at: string;
  doctorName?: string;
  doctorSpeciality?: string;
  doctorHospital?: string;
  patientName?: string;
  patientEmail?: string;
};

export type Report = {
  id: string;
  patient_id: string;
  medical_record_id?: string;
  title: string;
  file_url: string;
  file_type?: string;
  uploaded_at: string;
};

export type UserQuery = {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "admin" | string;
  subject: string;
  message: string;
  status: "pending" | "in_review" | "resolved";
  admin_response?: string;
  created_at: string;
  updated_at: string;
};

export type DoctorSession = {
  id: string;
  doctor_id: string;
  patient_id: string;
  approved: boolean;
  created_at: string;
  doctor?: {
    id: string;
    full_name: string;
    email: string;
    speciality?: string;
  };
  patient?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    blood_group?: string;
  };
};

export type UserRole = "patient" | "doctor" | "admin";

export type SessionPayload = {
  userId: string;
  email: string;
  role: UserRole;
  fullName?: string;
  speciality?: string;
  exp: number; // Unix timestamp in seconds
};
