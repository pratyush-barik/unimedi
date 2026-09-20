export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: "patient" | "doctor" | "admin";
  speciality?: string;
  license_number?: string;
  hospital_affiliation?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  address?: string;
};

export async function fetchCurrentSession(): Promise<{
  authenticated: boolean;
  user: AuthUser | null;
}> {
  try {
    const res = await fetch("/api/session", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return { authenticated: false, user: null };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    return { authenticated: false, user: null };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/logout", {
      method: "POST",
    });
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("session");
    }
  }
}
