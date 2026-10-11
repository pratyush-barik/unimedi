import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const FALLBACK_ADMIN_SECRET = "unimedi_admin_super_secret_key_2026_9b83a21e4f";

function checkAdminAuth(req: Request): boolean {
  const secret = req.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_SECRET || FALLBACK_ADMIN_SECRET;
  return Boolean(secret && secret === expected);
}

export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Single joined query: doctors joined with profiles and specialties
    const { data: doctorRows, error: docErr } = await supabase
      .from("doctors")
      .select(`
        id,
        license_number,
        hospital_affiliation,
        qualification,
        verification_status,
        created_at,
        specialty_id
      `)
      .order("created_at", { ascending: false });

    if (docErr) throw docErr;

    const list = (doctorRows || []) as any[];
    const doctorIds = list.map((d: any) => d.id);
    const specialtyIds = Array.from(new Set(list.map((d: any) => d.specialty_id).filter(Boolean)));

    let profilesMap = new Map();
    if (doctorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .in("id", doctorIds);
      (profiles || []).forEach((p: any) => profilesMap.set(p.id, p));
    }

    let specialtiesMap = new Map();
    if (specialtyIds.length > 0) {
      const { data: specs } = await supabase
        .from("medical_specialties")
        .select("id, name")
        .in("id", specialtyIds);
      (specs || []).forEach((s: any) => specialtiesMap.set(s.id, s.name));
    }

    const doctors = list.map((d: any) => {
      const p = profilesMap.get(d.id) || {};
      const specialtyName = specialtiesMap.get(d.specialty_id) || "General Medicine";
      return {
        id: d.id,
        email: p.email || "",
        full_name: p.full_name || "",
        phone: p.phone || "",
        speciality: specialtyName,
        qualification: d.qualification || "MBBS",
        license_number: d.license_number || "",
        hospital_affiliation: d.hospital_affiliation || "UniMedi Clinic",
        verification_status: d.verification_status || "verified",
        created_at: d.created_at,
      };
    });

    return Response.json({ success: true, doctors });
  } catch (error: any) {
    console.error("Admin doctors GET error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { email, full_name, phone, speciality, license_number, hospital_affiliation } = body;

    const cleanEmail = email?.trim().toLowerCase();
    const cleanName = full_name?.trim();

    if (!cleanEmail || !cleanName) {
      return Response.json(
        { success: false, message: "Full name and email are required." },
        { status: 400 }
      );
    }

    // 1. Check or create profile
    let { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile, error: createErr } = await supabase
        .from("profiles")
        .insert([
          {
            email: cleanEmail,
            full_name: cleanName,
            phone: phone?.trim() || null,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (createErr) throw createErr;
      profile = newProfile;
    } else {
      await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          phone: phone?.trim() || null,
        })
        .eq("id", profile.id);
    }

    // 2. Resolve specialty
    let specialtyId = "00000000-0000-0000-0001-000000000001"; // Default General Medicine
    if (speciality?.trim()) {
      const { data: matchedSpec } = await supabase
        .from("medical_specialties")
        .select("id")
        .ilike("name", `%${speciality.trim()}%`)
        .limit(1)
        .maybeSingle();
      if (matchedSpec?.id) {
        specialtyId = matchedSpec.id;
      }
    }

    // 3. Upsert doctor record
    const { data: existingDoc } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", profile.id)
      .maybeSingle();

    if (existingDoc) {
      await supabase
        .from("doctors")
        .update({
          specialty_id: specialtyId,
          license_number: license_number?.trim() || `MCI-${profile.id.substring(0, 8).toUpperCase()}`,
          hospital_affiliation: hospital_affiliation?.trim() || "UniMedi Central Dispensary",
          verification_status: "verified",
        })
        .eq("id", profile.id);
    } else {
      await supabase
        .from("doctors")
        .insert([
          {
            id: profile.id,
            specialty_id: specialtyId,
            license_number: license_number?.trim() || `MCI-${profile.id.substring(0, 8).toUpperCase()}`,
            hospital_affiliation: hospital_affiliation?.trim() || "UniMedi Central Dispensary",
            qualification: "MBBS",
            verification_status: "verified",
          },
        ]);
    }

    // 4. Ensure doctor role exists in user_roles
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", profile.id)
      .eq("role", "doctor")
      .maybeSingle();

    if (!existingRole) {
      await supabase
        .from("user_roles")
        .insert([{ user_id: profile.id, role: "doctor" }]);
    }

    return Response.json({
      success: true,
      message: "Doctor profile saved successfully.",
    });
  } catch (error: any) {
    console.error("Admin doctor POST error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, full_name, phone, speciality, license_number, hospital_affiliation } = body;

    if (!id) {
      return Response.json({ success: false, message: "Doctor ID is required." }, { status: 400 });
    }

    // Update profile info
    if (full_name !== undefined || phone !== undefined) {
      const updates: any = {};
      if (full_name) updates.full_name = full_name.trim();
      if (phone !== undefined) updates.phone = phone?.trim() || null;

      await supabase.from("profiles").update(updates).eq("id", id);
    }

    // Update doctor record
    const docUpdates: any = {};
    if (license_number !== undefined) docUpdates.license_number = license_number?.trim() || null;
    if (hospital_affiliation !== undefined)
      docUpdates.hospital_affiliation = hospital_affiliation?.trim() || null;

    if (speciality !== undefined) {
      const { data: matchedSpec } = await supabase
        .from("medical_specialties")
        .select("id")
        .ilike("name", `%${speciality.trim()}%`)
        .limit(1)
        .maybeSingle();
      if (matchedSpec?.id) {
        docUpdates.specialty_id = matchedSpec.id;
      }
    }

    if (Object.keys(docUpdates).length > 0) {
      await supabase.from("doctors").update(docUpdates).eq("id", id);
    }

    return Response.json({
      success: true,
      message: "Doctor updated successfully.",
    });
  } catch (error: any) {
    console.error("Admin doctor PATCH error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ success: false, message: "Doctor ID is required." }, { status: 400 });
    }

    // Delete doctor and user_roles
    await supabase.from("doctors").delete().eq("id", id);
    await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "doctor");

    return Response.json({
      success: true,
      message: "Doctor removed successfully.",
    });
  } catch (error: any) {
    console.error("Admin doctor DELETE error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
