import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint } = await params;
  if (endpoint !== "state" && endpoint !== "capabilities")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const port = Number(process.env.GATEWAY_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });
  try {
    const result = await fetch(`http://127.0.0.1:${port}/${endpoint}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
      redirect: "error",
    });
    if (!result.ok) throw new Error("Gateway unavailable");
    return NextResponse.json(await result.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });
  }
}
