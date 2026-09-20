export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { secret } = await req.json();
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret || secret !== adminSecret) {
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
