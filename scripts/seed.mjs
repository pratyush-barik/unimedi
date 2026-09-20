import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("==========================================");
  console.log("🌱 Starting UniMedi Database Clean Seed");
  console.log("==========================================");

  try {
    // 1. Clean existing records in dependency order
    console.log("🧹 Clearing old data...");
    await supabase.from("reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("user_queries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("medical_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("doctor_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("user_roles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("users").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    console.log("✅ Tables cleared.");

    // 2. Insert Doctors
    console.log("👨‍⚕️ Creating Doctor accounts...");
    const doctorsData = [
      {
        email: "dr.sharma@unimedi.org",
        full_name: "Rajesh Sharma",
        phone: "+91 9811002233",
        speciality: "Cardiology",
        license_number: "MD-CARD-7821",
        hospital_affiliation: "UniMedi Central Health Centre",
      },
      {
        email: "dr.ananya@unimedi.org",
        full_name: "Ananya Iyer",
        phone: "+91 9822003344",
        speciality: "General Physician & Pediatrics",
        license_number: "MD-GEN-9912",
        hospital_affiliation: "UniMedi Campus Clinic",
      },
      {
        email: "dr.kapoor@unimedi.org",
        full_name: "Vikram Kapoor",
        phone: "+91 9833004455",
        speciality: "Orthopedics & Sports Medicine",
        license_number: "MD-ORTHO-4501",
        hospital_affiliation: "UniMedi Sports Institute",
      },
    ];

    const doctorMap = new Map();

    for (const d of doctorsData) {
      const { data: user, error: uErr } = await supabase
        .from("users")
        .insert([
          {
            email: d.email,
            full_name: d.full_name,
            phone: d.phone,
            gender: "Male",
          },
        ])
        .select()
        .single();

      if (uErr) throw uErr;

      const { error: rErr } = await supabase.from("user_roles").insert([
        {
          user_id: user.id,
          role: "doctor",
          speciality: d.speciality,
          license_number: d.license_number,
          hospital_affiliation: d.hospital_affiliation,
        },
      ]);

      if (rErr) throw rErr;
      doctorMap.set(d.email, user);
      console.log(`  ✓ Doctor created: Dr. ${d.full_name} (${d.email})`);
    }

    // 3. Insert Patients
    console.log("👤 Creating Patient accounts...");
    const patientsData = [
      {
        email: "arun.patel@student.edu",
        full_name: "Arun Patel",
        phone: "+91 9876543210",
        blood_group: "O+",
        gender: "Male",
        date_of_birth: "2002-05-14",
        address: "Hostel Block 4, Room 210, Campus North",
      },
      {
        email: "priya.verma@student.edu",
        full_name: "Priya Verma",
        phone: "+91 9876543211",
        blood_group: "B+",
        gender: "Female",
        date_of_birth: "2003-08-22",
        address: "Hostel Block 2, Room 105, Campus South",
      },
      {
        email: "rohit.singh@student.edu",
        full_name: "Rohit Singh",
        phone: "+91 9876543212",
        blood_group: "AB+",
        gender: "Male",
        date_of_birth: "2001-11-03",
        address: "Day Scholar, Sector 15 Avenue",
      },
    ];

    const patientMap = new Map();

    for (const p of patientsData) {
      const { data: user, error: uErr } = await supabase
        .from("users")
        .insert([
          {
            email: p.email,
            full_name: p.full_name,
            phone: p.phone,
            blood_group: p.blood_group,
            gender: p.gender,
            date_of_birth: p.date_of_birth,
            address: p.address,
          },
        ])
        .select()
        .single();

      if (uErr) throw uErr;

      const { error: rErr } = await supabase.from("user_roles").insert([
        {
          user_id: user.id,
          role: "patient",
        },
      ]);

      if (rErr) throw rErr;
      patientMap.set(p.email, user);
      console.log(`  ✓ Patient created: ${p.full_name} (${p.email})`);
    }

    const docSharma = doctorMap.get("dr.sharma@unimedi.org");
    const docAnanya = doctorMap.get("dr.ananya@unimedi.org");
    const docKapoor = doctorMap.get("dr.kapoor@unimedi.org");

    const patientArun = patientMap.get("arun.patel@student.edu");
    const patientPriya = patientMap.get("priya.verma@student.edu");
    const patientRohit = patientMap.get("rohit.singh@student.edu");

    // 4. Insert Appointments
    console.log("🗓️ Creating Sample Appointments...");
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const dayAfter = new Date(Date.now() + 172800000).toISOString().split("T")[0];

    const appointmentsData = [
      {
        patient_id: patientArun.id,
        doctor_id: docSharma.id,
        appointment_date: tomorrow,
        time_slot: "10:00 AM - 10:30 AM",
        type: "online_booking",
        status: "confirmed",
        reason_for_visit: "Chest tightness and palpitations during physical training",
      },
      {
        patient_id: patientPriya.id,
        doctor_id: docAnanya.id,
        appointment_date: dayAfter,
        time_slot: "11:30 AM - 12:00 PM",
        type: "online_booking",
        status: "pending",
        reason_for_visit: "Persistent dry cough, mild seasonal throat irritation",
      },
      {
        patient_id: patientRohit.id,
        doctor_id: docKapoor.id,
        appointment_date: new Date().toISOString().split("T")[0],
        time_slot: "02:00 PM - 02:30 PM",
        type: "walk_in_qr",
        status: "completed",
        reason_for_visit: "Right ankle twist during basketball tournament",
        doctor_notes: "Grade 1 ligament strain. Prescribed analgesic and rest.",
      },
    ];

    let completedAptId = null;
    for (const apt of appointmentsData) {
      const { data: createdApt, error: aErr } = await supabase
        .from("appointments")
        .insert([apt])
        .select()
        .single();

      if (aErr) throw aErr;
      if (apt.status === "completed") {
        completedAptId = createdApt.id;
      }
    }
    console.log("  ✓ Sample appointments inserted.");

    // 5. Insert Medical Record / Prescription
    console.log("℞ Creating Sample Digital Prescription...");
    const { error: rxErr } = await supabase.from("medical_records").insert([
      {
        patient_id: patientRohit.id,
        doctor_id: docKapoor.id,
        appointment_id: completedAptId,
        diagnosis: "Right Ankle Inversion Injury (Grade 1 Lateral Ligament Strain)",
        medicines: [
          {
            name: "Aceclofenac + Paracetamol",
            dosage: "100mg / 325mg",
            frequency: "1-0-1",
            duration: "3 days",
            timing: "After Food",
            instructions: "Take with meals. Do not take on empty stomach.",
          },
          {
            name: "Trypsin Chymotrypsin",
            dosage: "100,000 Armour Units",
            frequency: "1-0-1",
            duration: "5 days",
            timing: "Before Food",
            instructions: "Take 30 mins before meals to reduce swelling.",
          },
          {
            name: "Diclofenac Topical Gel",
            dosage: "Apply thin layer",
            frequency: "0-0-1",
            duration: "5 days",
            timing: "Anytime",
            instructions: "Gently apply on affected ankle area twice daily.",
          },
        ],
        vitals: {
          bp: "118/78 mmHg",
          pulse: "74",
          temperature: "98.4 °F",
          spo2: "99%",
          weight: "68 kg",
        },
        lab_tests: [
          {
            test_name: "Right Ankle X-Ray (AP & Lateral)",
            result: "Normal (No fracture detected)",
            reference_range: "Intact cortical bone",
            notes: "Soft tissue swelling noted around lateral malleolus.",
          },
        ],
        notes: "Apply RICE protocol (Rest, Ice, Compression crepe bandage, Elevation). Avoid weight-bearing sports for 7 days. Follow up if swelling worsens.",
      },
    ]);

    if (rxErr) throw rxErr;
    console.log("  ✓ Medical record & prescription created.");

    // 6. Insert User Queries
    console.log("💬 Creating Sample Support Queries...");
    await supabase.from("user_queries").insert([
      {
        user_id: patientPriya.id,
        name: "Priya Verma",
        email: "priya.verma@student.edu",
        role: "patient",
        subject: "Medical Leave Certificate Request",
        message: "Hello, I visited the campus health centre on Monday for viral fever. Could the doctor kindly upload the digital medical certificate for college attendance?",
        status: "in_review",
        admin_response: "Under review by Dr. Ananya. Will be dispatched shortly.",
      },
      {
        user_id: patientArun.id,
        name: "Arun Patel",
        email: "arun.patel@student.edu",
        role: "patient",
        subject: "Prescription PDF Export Question",
        message: "Can I directly present the digital PDF prescription generated by UniMedi to the university campus pharmacy for medicine dispensing?",
        status: "resolved",
        admin_response: "Yes! All digital prescriptions issued via UniMedi are authorized and accepted across all campus pharmacy counters.",
      },
    ]);
    console.log("  ✓ User queries created.");

    console.log("==========================================");
    console.log("🎉 Database Clean Seed Finished Successfully!");
    console.log("==========================================");
    console.log("Demo Accounts Available:");
    console.log("Doctors: dr.sharma@unimedi.org, dr.ananya@unimedi.org, dr.kapoor@unimedi.org");
    console.log("Patients: arun.patel@student.edu, priya.verma@student.edu, rohit.singh@student.edu");
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Seed Error:", error);
  }
}

seed();
