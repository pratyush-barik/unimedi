import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function checkAdminAuth(req: Request): boolean {
  const secret = req.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_SECRET;
  return Boolean(expected && secret === expected);
}

export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all doctors from user_roles
    const { data: doctorRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("*")
      .eq("role", "doctor")
      .order("created_at", { ascending: false });

    if (rolesErr) throw rolesErr;

    const userIds = doctorRoles.map((r) => r.user_id);
    let usersMap = new Map();

    if (userIds.length > 0) {
      const { data: users, error: usersErr } = await supabase
        .from("users")
        .select("*")
        .in("id", userIds);

      if (usersErr) throw usersErr;
      usersMap = new Map(users.map((u) => [u.id, u]));
    }

    const doctors = doctorRoles.map((r) => {
      const user = usersMap.get(r.user_id) || {};
      return {
        id: r.user_id,
        role_id: r.id,
        email: user.email || "",
        full_name: user.full_name || "",
        phone: user.phone || "",
        speciality: r.speciality || "",
        license_number: r.license_number || "",
        hospital_affiliation: r.hospital_affiliation || "",
        created_at: r.created_at,
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

    // Check if user exists
    let { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: createErr } = await supabase
        .from("users")
        .insert([
          {
            email: cleanEmail,
            full_name: cleanName,
            phone: phone?.trim() || null,
          },
        ])
        .select()
        .single();

      if (createErr || !newUser) throw createErr || new Error("Failed to create user");
      user = newUser;
    } else {
      // Update existing user full_name/phone
      await supabase
        .from("users")
        .update({
          full_name: cleanName,
          phone: phone?.trim() || null,
        })
        .eq("id", user.id);
    }

    if (!user) {
      return Response.json(
        { success: false, message: "Failed to resolve user account." },
        { status: 500 }
      );
    }

    // Check if role exists
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "doctor")
      .maybeSingle();

    if (existingRole) {
      const { error: updateRoleErr } = await supabase
        .from("user_roles")
        .update({
          speciality: speciality?.trim() || "General Physician",
          license_number: license_number?.trim() || null,
          hospital_affiliation: hospital_affiliation?.trim() || null,
        })
        .eq("id", existingRole.id);

      if (updateRoleErr) throw updateRoleErr;
    } else {
      const { error: insertRoleErr } = await supabase
        .from("user_roles")
        .insert([
          {
            user_id: user.id,
            role: "doctor",
            speciality: speciality?.trim() || "General Physician",
            license_number: license_number?.trim() || null,
            hospital_affiliation: hospital_affiliation?.trim() || null,
          },
        ]);

      if (insertRoleErr) throw insertRoleErr;
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

    // Update user info
    if (full_name !== undefined || phone !== undefined) {
      const updates: any = {};
      if (full_name) updates.full_name = full_name.trim();
      if (phone !== undefined) updates.phone = phone?.trim() || null;

      await supabase.from("users").update(updates).eq("id", id);
    }

    // Update user_roles info
    const roleUpdates: any = {};
    if (speciality !== undefined) roleUpdates.speciality = speciality.trim();
    if (license_number !== undefined) roleUpdates.license_number = license_number?.trim() || null;
    if (hospital_affiliation !== undefined)
      roleUpdates.hospital_affiliation = hospital_affiliation?.trim() || null;

    if (Object.keys(roleUpdates).length > 0) {
      await supabase
        .from("user_roles")
        .update(roleUpdates)
        .eq("user_id", id)
        .eq("role", "doctor");
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

    // Delete doctor role and user
    await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "doctor");
    
    // Check if user has other roles; if not, delete user
    const { data: otherRoles } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", id);

    if (!otherRoles || otherRoles.length === 0) {
      await supabase.from("users").delete().eq("id", id);
    }

    return Response.json({
      success: true,
      message: "Doctor removed successfully.",
    });
  } catch (error: any) {
    console.error("Admin doctor DELETE error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
