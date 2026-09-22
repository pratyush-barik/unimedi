import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Default initial data for resilient demo execution
const INITIAL_DOCTORS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    email: "sangeetakumarinew0606@gmail.com",
    full_name: "Sangeeta Kumari",
    phone: "+91 9876543210",
    blood_group: "O+",
    gender: "Female",
    date_of_birth: "1988-06-06",
    address: "Campus Health Centre, Senior Physician Suite",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-a111-111111111111",
    email: "scarlight.c39@gmail.com",
    full_name: "Rajesh Sharma",
    phone: "+91 9811122233",
    blood_group: "O+",
    gender: "Male",
    date_of_birth: "1978-04-12",
    address: "Campus Health Centre, Cardiology Suite 101",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_PATIENTS = [
  {
    id: "44444444-4444-4444-a444-444444444444",
    email: "arun.patel.unimedi@gmail.com",
    full_name: "Arun Patel",
    phone: "+91 9876543210",
    blood_group: "O+",
    gender: "Male",
    date_of_birth: "2002-05-14",
    address: "Hostel Block 4, Room 210, Campus North",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "55555555-5555-4555-a555-555555555555",
    email: "priya.verma.unimedi@gmail.com",
    full_name: "Priya Verma",
    phone: "+91 9876543211",
    blood_group: "B+",
    gender: "Female",
    date_of_birth: "2003-08-22",
    address: "Hostel Block 2, Room 105, Campus South",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "66666666-6666-4666-a666-666666666666",
    email: "rohit.singh.unimedi@gmail.com",
    full_name: "Rohit Singh",
    phone: "+91 9876543212",
    blood_group: "AB+",
    gender: "Male",
    date_of_birth: "2001-11-03",
    address: "Day Scholar, Sector 15 Avenue",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "77777777-7777-4777-a777-777777777777",
    email: "ananya.sen.unimedi@gmail.com",
    full_name: "Ananya Sen",
    phone: "+91 9876543213",
    blood_group: "A+",
    gender: "Female",
    date_of_birth: "2002-12-10",
    address: "Hostel Block 1, Room 304, Campus East",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "88888888-8888-4888-a888-888888888888",
    email: "rahul.verma.unimedi@gmail.com",
    full_name: "Rahul Verma",
    phone: "+91 9876543214",
    blood_group: "B-",
    gender: "Male",
    date_of_birth: "2000-03-25",
    address: "Graduate Housing, Flat 12B",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_ROLES = [
  {
    id: "r0-0000-0000",
    user_id: "00000000-0000-4000-a000-000000000001",
    role: "doctor",
    speciality: "General Physician & Consultant",
    license_number: "MCI-77391-S",
    hospital_affiliation: "University Central Medical Centre",
    created_at: new Date().toISOString(),
  },
  {
    id: "r1-1111-1111",
    user_id: "11111111-1111-4111-a111-111111111111",
    role: "doctor",
    speciality: "Cardiology",
    license_number: "MCI-48291-C",
    hospital_affiliation: "University Central Medical Centre",
    created_at: new Date().toISOString(),
  },
  {
    id: "r4-4444-4444",
    user_id: "44444444-4444-4444-a444-444444444444",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "r5-5555-5555",
    user_id: "55555555-5555-4555-a555-555555555555",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "r6-6666-6666",
    user_id: "66666666-6666-4666-a666-666666666666",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "r7-7777-7777",
    user_id: "77777777-7777-4777-a777-777777777777",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "r8-8888-8888",
    user_id: "88888888-8888-4888-a888-888888888888",
    role: "patient",
    speciality: null,
    license_number: null,
    hospital_affiliation: null,
    created_at: new Date().toISOString(),
  },
];

const todayDate = new Date().toISOString().split("T")[0];
const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split("T")[0];

const SAMPLE_APPOINTMENTS = [
  // Today's appointments for Dr. Sangeeta Kumari
  {
    id: "apt-sang-1",
    patient_id: "44444444-4444-4444-a444-444444444444",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: todayDate,
    time_slot: "10:00 AM - 10:30 AM",
    type: "online_booking",
    status: "confirmed",
    reason_for_visit: "Recurrent migraine headaches & vision blur after late-night study sessions",
    doctor_notes: "Scheduled for morning consultation. Blood pressure check recommended.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "apt-sang-2",
    patient_id: "55555555-5555-4555-a555-555555555555",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: todayDate,
    time_slot: "11:00 AM - 11:30 AM",
    type: "online_booking",
    status: "confirmed",
    reason_for_visit: "Seasonal viral fever, persistent dry cough and sore throat for 3 days",
    doctor_notes: "Check temperature and throat erythema.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "apt-sang-3",
    patient_id: "66666666-6666-4666-a666-666666666666",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: todayDate,
    time_slot: "02:00 PM - 02:30 PM",
    type: "walk_in_qr",
    status: "confirmed",
    reason_for_visit: "Acute right knee inversion twist during campus basketball match",
    doctor_notes: "Walk-in patient via clinic QR. Check for joint effusion.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "apt-sang-4",
    patient_id: "77777777-7777-4777-a777-777777777777",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: todayDate,
    time_slot: "03:30 PM - 04:00 PM",
    type: "online_booking",
    status: "pending",
    reason_for_visit: "Routine annual student health checkup and CBC blood report review",
    doctor_notes: "Pending doctor confirmation.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "apt-sang-5",
    patient_id: "88888888-8888-4888-a888-888888888888",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: yesterdayDate,
    time_slot: "04:00 PM - 04:30 PM",
    type: "online_booking",
    status: "completed",
    reason_for_visit: "Follow-up consultation for allergic rhinitis and nasal congestion",
    doctor_notes: "Symptoms improved with antihistamines. Completed.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Sample appointments for other doctors
  {
    id: "apt-1",
    patient_id: "44444444-4444-4444-a444-444444444444",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_date: tomorrowDate,
    time_slot: "10:00 AM - 10:30 AM",
    type: "online_booking",
    status: "confirmed",
    reason_for_visit: "Chest tightness and palpitations during physical training",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Additional appointments for Priya Verma (Dr. Sharma)
  {
    id: "apt-priya-1",
    patient_id: "55555555-5555-4555-a555-555555555555",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_date: tomorrowDate,
    time_slot: "09:30 AM - 10:00 AM",
    type: "online_booking",
    status: "confirmed",
    reason_for_visit: "Persistent dry cough and mild seasonal throat irritation for 4 days",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "apt-priya-2",
    patient_id: "55555555-5555-4555-a555-555555555555",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: yesterdayDate,
    time_slot: "10:00 AM - 10:30 AM",
    type: "online_booking",
    status: "completed",
    reason_for_visit: "Viral fever 101°F, body ache and fatigue",
    doctor_notes: "Viral infection confirmed. Prescribed antipyretics and rest.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  // Ananya Sen appointments
  {
    id: "apt-ananya-1",
    patient_id: "77777777-7777-4777-a777-777777777777",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_date: todayDate,
    time_slot: "12:00 PM - 12:30 PM",
    type: "online_booking",
    status: "pending",
    reason_for_visit: "Routine annual health checkup and CBC blood report review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "apt-ananya-2",
    patient_id: "77777777-7777-4777-a777-777777777777",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_date: yesterdayDate,
    time_slot: "03:00 PM - 03:30 PM",
    type: "walk_in_qr",
    status: "completed",
    reason_for_visit: "Acute stomach cramps and mild dehydration after canteen food",
    doctor_notes: "Gastritis suspected. Prescribed antacids and ORS.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  // Rohit Singh additional appointments
  {
    id: "apt-rohit-1",
    patient_id: "66666666-6666-4666-a666-666666666666",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_date: tomorrowDate,
    time_slot: "03:00 PM - 03:30 PM",
    type: "online_booking",
    status: "confirmed",
    reason_for_visit: "ECG follow-up after exercise-induced palpitations during training",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Rahul Verma appointments
  {
    id: "apt-rahul-1",
    patient_id: "88888888-8888-4888-a888-888888888888",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_date: tomorrowDate,
    time_slot: "11:00 AM - 11:30 AM",
    type: "online_booking",
    status: "confirmed",
    reason_for_visit: "Follow-up consultation for allergic rhinitis and nasal congestion",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const SAMPLE_MEDICAL_RECORDS = [
  {
    id: "med-sang-1",
    patient_id: "44444444-4444-4444-a444-444444444444",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_id: "apt-sang-1",
    diagnosis: "Tension Migraine with Bilateral Ocular Fatigue",
    medicines: [
      {
        name: "Rizatriptan Oral Lyophilisate",
        dosage: "10mg",
        frequency: "1-0-0",
        duration: "As needed",
        timing: "At onset of headache",
        instructions: "Dissolve on tongue at migraine onset. Do not exceed 20mg in 24 hours.",
      },
      {
        name: "Naproxen Sodium",
        dosage: "250mg",
        frequency: "1-0-1",
        duration: "3 days",
        timing: "After Food",
        instructions: "Take with food or milk to prevent gastric irritation.",
      },
      {
        name: "Magnesium Glycinate + Vitamin B2 (Riboflavin)",
        dosage: "400mg",
        frequency: "0-1-0",
        duration: "30 days",
        timing: "After Lunch",
        instructions: "Daily neuro-support supplement.",
      },
    ],
    vitals: {
      bp: "116/76 mmHg",
      pulse: "72 bpm",
      temperature: "98.4 °F",
      spo2: "99%",
      weight: "66 kg",
    },
    lab_tests: [
      {
        test_name: "Ophthalmic Refraction & Visual Acuity",
        result: "6/6 Right, 6/6 Left (Mild 0.5 Cylindrical Astigmatism)",
        reference_range: "Normal 6/6",
        notes: "Blue-light protective computer eyewear advised.",
      },
    ],
    notes: "Follow 20-20-20 rule during screen use. Maintain 8 hours sleep cycle and adequate hydration. Review in 3 weeks.",
    created_at: new Date().toISOString(),
  },
  {
    id: "med-sang-2",
    patient_id: "55555555-5555-4555-a555-555555555555",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_id: "apt-sang-2",
    diagnosis: "Acute Upper Respiratory Tract Pharyngitis (Viral)",
    medicines: [
      {
        name: "Paracetamol + Caffeine",
        dosage: "650mg / 50mg",
        frequency: "1-1-1",
        duration: "3 days",
        timing: "After Food",
        instructions: "For relief of body ache, headache and fever spikes.",
      },
      {
        name: "Levocetirizine + Montelukast",
        dosage: "5mg / 10mg",
        frequency: "0-0-1",
        duration: "5 days",
        timing: "At Bedtime",
        instructions: "Reduces throat itching, rhinorrhea and nocturnal cough.",
      },
      {
        name: "Povidone-Iodine 0.5% Throat Gargle",
        dosage: "10ml diluted in warm water",
        frequency: "1-0-1",
        duration: "5 days",
        timing: "After Food",
        instructions: "Gargle for 30 seconds twice daily. Do not swallow.",
      },
    ],
    vitals: {
      bp: "110/72 mmHg",
      pulse: "82 bpm",
      temperature: "99.8 °F",
      spo2: "98%",
      weight: "53 kg",
    },
    lab_tests: [
      {
        test_name: "C-Reactive Protein (Qualitative / Semi-Quantitative)",
        result: "10 mg/L (Mild acute elevation)",
        reference_range: "< 5 mg/L",
        notes: "Consistent with early viral respiratory inflammation.",
      },
    ],
    notes: "Rest in hostel for 48 hours. Warm fluids, honey and steam inhalation twice daily. Dispatched medical exemption certificate.",
    created_at: new Date().toISOString(),
  },
  {
    id: "med-sang-3",
    patient_id: "88888888-8888-4888-a888-888888888888",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_id: "apt-sang-5",
    diagnosis: "Perennial Allergic Rhinitis with Mild Sinonasal Congestion",
    medicines: [
      {
        name: "Fluticasone Furoate Nasal Spray",
        dosage: "27.5 mcg/spray (2 sprays per nostril)",
        frequency: "1-0-0",
        duration: "14 days",
        timing: "Morning",
        instructions: "Administer after clearing nasal passages.",
      },
      {
        name: "Bilastine",
        dosage: "20mg",
        frequency: "1-0-0",
        duration: "10 days",
        timing: "Before Breakfast",
        instructions: "Non-sedative antihistamine. Take on empty stomach with water.",
      },
    ],
    vitals: {
      bp: "120/78 mmHg",
      pulse: "70 bpm",
      temperature: "98.6 °F",
      spo2: "99%",
      weight: "70 kg",
    },
    lab_tests: [
      {
        test_name: "Absolute Eosinophil Count (AEC)",
        result: "420 cells/mcL",
        reference_range: "40 - 400 cells/mcL",
        notes: "Mild atopic allergic predisposition.",
      },
    ],
    notes: "Avoid dust exposure, use HEPA/dust mask during campus outdoor activities. Follow-up after 2 weeks if congestion persists.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  // Sample record for Dr. Sharma
  {
    id: "med-1",
    patient_id: "66666666-6666-4666-a666-666666666666",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_id: "apt-sang-3",
    diagnosis: "Right Ankle Inversion Injury (Grade 1 Lateral Ligament Strain)",
    medicines: [
      {
        name: "Aceclofenac + Paracetamol",
        dosage: "100mg / 325mg",
        frequency: "1-0-1",
        duration: "3 days",
        timing: "After Food",
        instructions: "Take with meals.",
      },
    ],
    vitals: {
      bp: "118/78 mmHg",
      pulse: "74 bpm",
      temperature: "98.4 °F",
      spo2: "99%",
      weight: "68 kg",
    },
    lab_tests: [],
    notes: "Apply RICE protocol.",
    created_at: new Date().toISOString(),
  },
  // Priya Verma prescription (Dr. Sharma - viral fever)
  {
    id: "med-priya-1",
    patient_id: "55555555-5555-4555-a555-555555555555",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_id: "apt-priya-2",
    diagnosis: "Acute Viral Pharyngitis with Low Grade Fever",
    medicines: [
      {
        name: "Paracetamol 650mg",
        dosage: "650mg",
        frequency: "1-1-1",
        duration: "3 days",
        timing: "After Food",
        instructions: "Take with food or milk. Do not exceed 3 tablets per day.",
      },
      {
        name: "Levocetirizine + Montelukast",
        dosage: "5mg / 10mg",
        frequency: "0-0-1",
        duration: "5 days",
        timing: "At Bedtime",
        instructions: "Relieves throat irritation and nocturnal cough.",
      },
      {
        name: "Azithromycin",
        dosage: "500mg",
        frequency: "1-0-0",
        duration: "3 days",
        timing: "Before Breakfast",
        instructions: "Take on empty stomach. Complete the full course.",
      },
    ],
    vitals: {
      bp: "108/70 mmHg",
      pulse: "88 bpm",
      temperature: "101.2°F",
      spo2: "97%",
      weight: "53 kg",
    },
    lab_tests: [
      {
        test_name: "Rapid Antigen Test (COVID-19)",
        result: "Negative",
        reference_range: "Negative",
        notes: "Consistent with seasonal viral infection.",
      },
      {
        test_name: "Throat Swab Culture",
        result: "Normal flora — no pathogenic growth",
        reference_range: "No pathogen",
        notes: "Viral aetiology confirmed.",
      },
    ],
    notes: "Rest for 48 hours. Warm fluids, steam inhalation and honey-ginger tea advised. Medical exemption submitted to college office.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  // Ananya Sen prescription (Dr. Sangeeta - gastritis)
  {
    id: "med-ananya-1",
    patient_id: "77777777-7777-4777-a777-777777777777",
    doctor_id: "00000000-0000-4000-a000-000000000001",
    appointment_id: "apt-ananya-2",
    diagnosis: "Acute Gastroenteritis with Mild Dehydration",
    medicines: [
      {
        name: "Pantoprazole",
        dosage: "40mg",
        frequency: "1-0-0",
        duration: "5 days",
        timing: "Before Breakfast",
        instructions: "Take 30 minutes before meals on empty stomach.",
      },
      {
        name: "Domperidone",
        dosage: "10mg",
        frequency: "1-1-1",
        duration: "3 days",
        timing: "Before Food",
        instructions: "Take 15-30 mins before each meal to control nausea.",
      },
      {
        name: "ORS (Oral Rehydration Salts)",
        dosage: "1 sachet in 200ml water",
        frequency: "1-1-1",
        duration: "2 days",
        timing: "After Food",
        instructions: "Sip slowly after meals. Prepare fresh each time.",
      },
    ],
    vitals: {
      bp: "102/68 mmHg",
      pulse: "96 bpm",
      temperature: "99.2°F",
      spo2: "98%",
      weight: "52 kg",
    },
    lab_tests: [
      {
        test_name: "Stool Routine Microscopy",
        result: "No ova or cysts detected",
        reference_range: "No parasites",
        notes: "Viral gastroenteritis pattern.",
      },
    ],
    notes: "Light diet — rice, curd, banana for 2 days. Avoid oily/spicy canteen food. Adequate hydration critical. Review if symptoms worsen.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  // Arun Patel prescription (Dr. Sharma - cardiology)
  {
    id: "med-arun-1",
    patient_id: "44444444-4444-4444-a444-444444444444",
    doctor_id: "11111111-1111-4111-a111-111111111111",
    appointment_id: "apt-1",
    diagnosis: "Exercise-Induced Sinus Tachycardia (Benign) with Mild Anxiety",
    medicines: [
      {
        name: "Propranolol",
        dosage: "10mg",
        frequency: "0-0-1",
        duration: "14 days",
        timing: "Before Bed",
        instructions: "Low-dose beta-blocker. Monitor resting heart rate. Do not stop abruptly.",
      },
      {
        name: "Magnesium Oxide",
        dosage: "400mg",
        frequency: "0-1-0",
        duration: "30 days",
        timing: "After Lunch",
        instructions: "Cardiac muscle support supplement. Take with food.",
      },
    ],
    vitals: {
      bp: "122/80 mmHg",
      pulse: "102 bpm",
      temperature: "98.6°F",
      spo2: "99%",
      weight: "68 kg",
    },
    lab_tests: [
      {
        test_name: "12-Lead ECG",
        result: "Sinus tachycardia, HR 105 bpm — no ST changes",
        reference_range: "Normal sinus rhythm 60-100 bpm",
        notes: "Benign tachycardia. No arrhythmia pattern detected.",
      },
      {
        test_name: "2D Echocardiogram",
        result: "Normal LV function, EF 65%, no structural abnormality",
        reference_range: "EF > 55%",
        notes: "Normal cardiac structure and function.",
      },
    ],
    notes: "Reduce caffeine intake. Avoid energy drinks and intense pre-workout supplements. Aerobic warm-up protocol recommended before training sessions. Follow-up in 3 weeks with Holter monitor if palpitations recur.",
    created_at: new Date().toISOString(),
  },
];

type StoreData = {
  users: any[];
  user_roles: any[];
  doctor_sessions: any[];
  appointments: any[];
  medical_records: any[];
  reports: any[];
  user_queries: any[];
};

const globalForDB = globalThis as unknown as {
  unimediStore?: StoreData;
};

if (!globalForDB.unimediStore) {
  globalForDB.unimediStore = {
    users: [...INITIAL_DOCTORS, ...INITIAL_PATIENTS],
    user_roles: [...INITIAL_ROLES],
    doctor_sessions: [
      {
        id: "sess-1",
        doctor_id: "00000000-0000-4000-a000-000000000001",
        patient_id: "44444444-4444-4444-a444-444444444444",
        approved: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "sess-2",
        doctor_id: "11111111-1111-4111-a111-111111111111",
        patient_id: "55555555-5555-4555-a555-555555555555",
        approved: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "sess-3",
        doctor_id: "11111111-1111-4111-a111-111111111111",
        patient_id: "66666666-6666-4666-a666-666666666666",
        approved: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "sess-4",
        doctor_id: "00000000-0000-4000-a000-000000000001",
        patient_id: "77777777-7777-4777-a777-777777777777",
        approved: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    appointments: [...SAMPLE_APPOINTMENTS],
    medical_records: [...SAMPLE_MEDICAL_RECORDS],
    reports: [],
    user_queries: [
      {
        id: "uq-1",
        user_id: "55555555-5555-4555-a555-555555555555",
        name: "Priya Verma",
        email: "priya.verma.unimedi@gmail.com",
        role: "patient",
        subject: "Medical Leave Certificate Request",
        message: "Hello, I visited the campus health centre yesterday for viral fever. Could the doctor kindly upload the digital medical certificate for college attendance office?",
        status: "in_review",
        admin_response: "Under review by the Medical Officer. Medical certificate will be dispatched within 24 hours.",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "uq-2",
        user_id: "44444444-4444-4444-a444-444444444444",
        name: "Arun Patel",
        email: "arun.patel.unimedi@gmail.com",
        role: "patient",
        subject: "Prescription PDF Export Question",
        message: "Can I directly present the digital PDF prescription generated by UniMedi to the university campus pharmacy for medicine dispensing?",
        status: "resolved",
        admin_response: "Yes! All digital prescriptions issued via UniMedi are authorized and accepted at all campus pharmacy counters. Show the QR-code on the PDF for instant verification.",
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "uq-3",
        user_id: "66666666-6666-4666-a666-666666666666",
        name: "Rohit Singh",
        email: "rohit.singh.unimedi@gmail.com",
        role: "patient",
        subject: "Unable to Book Appointment Slot",
        message: "I am trying to book a follow-up appointment with the cardiologist for my ECG review but the 3 PM slot shows as unavailable. Could you please check and assist?",
        status: "pending",
        admin_response: null,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "uq-4",
        user_id: "77777777-7777-4777-a777-777777777777",
        name: "Ananya Sen",
        email: "ananya.sen.unimedi@gmail.com",
        role: "patient",
        subject: "QR Scanner Not Working on iPhone",
        message: "When I try to scan the doctor QR code at the clinic using the UniMedi app on my iPhone, the camera opens but doesn't detect the QR. I have given camera permission. Please help.",
        status: "in_review",
        admin_response: "We have escalated this to the technical team. As a workaround, please try switching to rear camera using the flip button on the scanner screen.",
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "uq-5",
        user_id: null,
        name: "Dr. Meera Pillai",
        email: "dr.meera.pillai@newdoc.com",
        role: "doctor",
        subject: "Request for Doctor Account Registration",
        message: "I am a newly joined General Physician at the university medical centre. My credentials: MBBS, MD (General Medicine), License MCI-78291-GP. Please provision my UniMedi doctor account.",
        status: "pending",
        admin_response: null,
        created_at: new Date(Date.now() - 900000).toISOString(),
        updated_at: new Date(Date.now() - 900000).toISOString(),
      },
    ],
  };
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type QueryResult = {
  data: any;
  error: any;
  count?: number | null;
};

class LocalQueryBuilder {
  private tableName: keyof StoreData;
  private filters: Array<(row: any) => boolean> = [];
  private orderConfig: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private pendingInsert: any[] | null = null;
  private pendingUpdate: any | null = null;
  private isDelete: boolean = false;

  constructor(tableName: keyof StoreData) {
    this.tableName = tableName;
    const store = globalForDB.unimediStore!;
    if (!store[tableName]) {
      store[tableName] = [];
    }
  }

  select(_columns: string = "*", _options?: { count?: string; head?: boolean }) {
    return this;
  }

  insert(rows: any | any[]) {
    this.pendingInsert = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(updates: any) {
    this.pendingUpdate = updates;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderConfig = { column, ascending };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private execute(): QueryResult {
    const store = globalForDB.unimediStore!;
    const table = store[this.tableName] || [];

    // INSERT
    if (this.pendingInsert) {
      const insertedRows = this.pendingInsert.map((item) => {
        const row = {
          id: item.id || generateUUID(),
          ...item,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        };
        table.push(row);
        return row;
      });
      return { data: insertedRows, error: null, count: insertedRows.length };
    }

    // UPDATE
    if (this.pendingUpdate) {
      let matchedRows: any[] = [];
      for (const row of table) {
        const match = this.filters.every((f) => f(row));
        if (match) {
          Object.assign(row, this.pendingUpdate, { updated_at: new Date().toISOString() });
          matchedRows.push(row);
        }
      }
      return { data: matchedRows, error: null, count: matchedRows.length };
    }

    // DELETE
    if (this.isDelete) {
      const remainingRows = table.filter((row) => !this.filters.every((f) => f(row)));
      store[this.tableName] = remainingRows;
      return { data: null, error: null, count: 0 };
    }

    // SELECT
    let result = table.filter((row) => this.filters.every((f) => f(row)));

    if (this.orderConfig) {
      const { column, ascending } = this.orderConfig;
      result.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    return { data: result, error: null, count: result.length };
  }

  async single(): Promise<QueryResult> {
    const { data } = this.execute();
    if (Array.isArray(data) && data.length > 0) {
      return { data: data[0], error: null, count: 1 };
    }
    return { data: null, error: { message: "Row not found", code: "PGRST116" }, count: 0 };
  }

  async maybeSingle(): Promise<QueryResult> {
    const { data } = this.execute();
    if (Array.isArray(data) && data.length > 0) {
      return { data: data[0], error: null, count: 1 };
    }
    return { data: null, error: null, count: 0 };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const res = this.execute();
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }
}

// Resilient Supabase client instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let rawSupabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("undefined") && supabaseUrl.startsWith("http")) {
  try {
    rawSupabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.warn("Failed to initialize raw Supabase client, using resilient fallback:", e);
  }
}

export const supabase = {
  from(tableName: string) {
    return new LocalQueryBuilder(tableName as keyof StoreData);
  },
};
