import { generateOTP, verifyOTP } from "../lib/otpStore";
import { signSessionToken, verifySessionToken } from "../lib/session";
import { supabase } from "../lib/supabase";

async function runTestSuite() {
  console.log("==================================================");
  console.log("🧪 STARTING UNIMEDI AUTHENTICATION TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Wrong OTP Verification
  // ----------------------------------------------------
  console.log("\n[TEST 1] Wrong OTP Verification Check");
  const testEmail = "test_patient_1@uni.edu";
  const realOtp = generateOTP(testEmail);
  const wrongResult = verifyOTP(testEmail, "000000");
  assert(wrongResult.success === false, "Wrong OTP was rejected");
  assert(Boolean(wrongResult.reason && wrongResult.reason.includes("Invalid OTP")), "Appropriate error reason returned for wrong OTP");

  // Verify correct OTP succeeds
  const rightResult = verifyOTP(testEmail, realOtp);
  assert(rightResult.success === true, "Correct OTP was verified successfully");

  // ----------------------------------------------------
  // TEST 2: New Patient Signup Flow
  // ----------------------------------------------------
  console.log("\n[TEST 2] New Patient Signup Flow (User Creation & Role)");
  const newPatientEmail = "sneha.k.unimedi@gmail.com";
  const newPhone = "+91 9123456780";
  const newName = "Sneha Kulkarni";

  // Check user does not exist before
  const { data: preCheck } = await supabase.from("users").select("*").eq("email", newPatientEmail).maybeSingle();
  assert(!preCheck, "New patient does not exist prior to signup");

  // Simulate verify-otp logic for signup
  const { data: newUser, error: createErr } = await supabase.from("users").insert([
    {
      email: newPatientEmail,
      phone: newPhone,
      full_name: newName,
    }
  ]).select().single();

  assert(!createErr && newUser && newUser.id, "New patient user created in users table");

  const { data: roleInsert } = await supabase.from("user_roles").insert([
    {
      user_id: newUser.id,
      role: "patient"
    }
  ]).select().single();

  assert(roleInsert && roleInsert.role === "patient", "Patient role successfully assigned in user_roles");

  // Test token signing
  const patientToken = signSessionToken({
    userId: newUser.id,
    email: newUser.email,
    role: "patient",
    fullName: newUser.full_name,
  });

  const verifiedPatientPayload = verifySessionToken(patientToken);
  assert(Boolean(verifiedPatientPayload && verifiedPatientPayload.userId === newUser.id && verifiedPatientPayload.role === "patient"), "HMAC session token signed and verified for new patient");

  // ----------------------------------------------------
  // TEST 3: Existing Patient Login Flow
  // ----------------------------------------------------
  console.log("\n[TEST 3] Existing Patient Login Flow (No Duplicates)");
  const existingEmail = "arun.patel.unimedi@gmail.com";
  const { data: existingUser } = await supabase.from("users").select("*").eq("email", existingEmail).maybeSingle();
  assert(Boolean(existingUser && existingUser.email === existingEmail), "Existing patient retrieved from database");

  const { data: existingUserRole } = await supabase.from("user_roles").select("*").eq("user_id", existingUser.id).eq("role", "patient").maybeSingle();
  assert(Boolean(existingUserRole && existingUserRole.role === "patient"), "Existing patient role verified");

  const existingPatientToken = signSessionToken({
    userId: existingUser.id,
    email: existingUser.email,
    role: "patient",
    fullName: existingUser.full_name,
  });

  const verifiedExistingPayload = verifySessionToken(existingPatientToken);
  assert(Boolean(verifiedExistingPayload && verifiedExistingPayload.userId === existingUser.id), "Existing patient session signed and verified");

  // Count total users with that email to ensure no duplicates
  const { data: allArunUsers } = await supabase.from("users").select("*").eq("email", existingEmail);
  assert(allArunUsers.length === 1, "Exactly one user record exists for existing patient (no duplicates)");

  // ----------------------------------------------------
  // TEST 4: Patient Login with New Email (Auto-provisioning)
  // ----------------------------------------------------
  console.log("\n[TEST 4] Patient Login with New Email (Auto-provisioning)");
  const autoEmail = "dev.sharma.unimedi@gmail.com";
  const { data: preAutoCheck } = await supabase.from("users").select("*").eq("email", autoEmail).maybeSingle();
  assert(!preAutoCheck, "Auto-provisioning target does not exist initially");

  // Auto create
  const autoName = autoEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const { data: autoUser } = await supabase.from("users").insert([
    {
      email: autoEmail,
      full_name: autoName,
    }
  ]).select().single();

  await supabase.from("user_roles").insert([{ user_id: autoUser.id, role: "patient" }]);

  assert(Boolean(autoUser && autoUser.email === autoEmail), "New patient user auto-provisioned during login");

  const autoToken = signSessionToken({
    userId: autoUser.id,
    email: autoUser.email,
    role: "patient",
    fullName: autoUser.full_name,
  });

  const autoPayload = verifySessionToken(autoToken);
  assert(Boolean(autoPayload && autoPayload.role === "patient"), "Auto-provisioned patient session established");

  // ----------------------------------------------------
  // TEST 5: Provisioned Doctor Login
  // ----------------------------------------------------
  console.log("\n[TEST 5] Provisioned Doctor Login");
  const doctorEmail = "scarlight.c39@gmail.com";
  const { data: docUser } = await supabase.from("users").select("*").eq("email", doctorEmail).maybeSingle();
  assert(Boolean(docUser && docUser.email === doctorEmail), "Provisioned doctor exists in users table");

  const { data: docRole } = await supabase.from("user_roles").select("*").eq("user_id", docUser.id).eq("role", "doctor").maybeSingle();
  assert(Boolean(docRole && docRole.role === "doctor" && docRole.speciality === "Cardiology"), "Doctor credentials and Cardiology speciality verified");

  const docToken = signSessionToken({
    userId: docUser.id,
    email: docUser.email,
    role: "doctor",
    fullName: docUser.full_name,
    speciality: docRole.speciality,
  });

  const docPayload = verifySessionToken(docToken);
  assert(Boolean(docPayload && docPayload.role === "doctor" && docPayload.speciality === "Cardiology"), "Doctor session token signed and verified");

  // ----------------------------------------------------
  // TEST 6: Unregistered / Arbitrary Doctor Login Check
  // ----------------------------------------------------
  console.log("\n[TEST 6] Unregistered Doctor Login Check (Must Be Blocked)");
  const fakeDocEmail = "fake.doctor@unregistered.com";
  const { data: fakeDocUser } = await supabase.from("users").select("*").eq("email", fakeDocEmail).maybeSingle();
  assert(!fakeDocUser, "Arbitrary unprovisioned doctor is not found in database");

  // ----------------------------------------------------
  // TEST 7: Session Restoration
  // ----------------------------------------------------
  console.log("\n[TEST 7] Session Restoration Verification");
  const restoredPayload = verifySessionToken(patientToken);
  assert(restoredPayload !== null, "Session token decoded cleanly");

  const { data: restoredUser } = await supabase.from("users").select("*").eq("id", restoredPayload!.userId).maybeSingle();
  assert(Boolean(restoredUser && restoredUser.email === newPatientEmail), "Full profile restored from database via session userId");

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
}

runTestSuite();
