import fs from "fs";
import path from "path";

function searchDir(dir, pattern) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".git") {
      searchDir(full, pattern);
    } else if (e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx"))) {
      const content = fs.readFileSync(full, "utf8");
      if (pattern.test(content)) {
        console.log("Found match in:", full);
      }
    }
  }
}

console.log("Checking app/ directory for legacy table references...");
searchDir("app", /\.from\(["'](users|medical_records|doctor_sessions|legacy_patient_profiles|legacy_user_roles|legacy_appointments)["']\)/);

console.log("Checking lib/ directory for legacy table references...");
searchDir("lib", /\.from\(["'](users|medical_records|doctor_sessions|legacy_patient_profiles|legacy_user_roles|legacy_appointments)["']\)/);

console.log("Done checking references.");
