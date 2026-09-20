import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Clear session_token cookie
    cookieStore.set("session_token", "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    // Clear legacy session cookie if any
    cookieStore.set("session", "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
    });

    return Response.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        message: error.message || "Logout failed",
      },
      { status: 500 }
    );
  }
}