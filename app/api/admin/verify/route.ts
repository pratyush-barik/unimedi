export const runtime = "nodejs";

const FALLBACK_ADMIN_SECRET = "unimedi_admin_super_secret_key_2026_9b83a21e4f";

export async function POST(req: Request) {
  try {
    const { secret } = await req.json();
    const adminSecret = process.env.ADMIN_SECRET || FALLBACK_ADMIN_SECRET;

    if (!secret || secret !== adminSecret) {
      return Response.json(
        { success: false, message: "Invalid admin passkey." },
        { status: 401 }
      );
    }

    return Response.json({
      success: true,
      message: "Admin authentication successful.",
    });
  } catch (error: any) {
    return Response.json(
      { success: false, message: "Authentication failed." },
      { status: 500 }
    );
  }
}
