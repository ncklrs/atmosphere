import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const actions = new Set(["state", "pair", "enable", "disable", "settings"]);
async function relay(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!actions.has(action))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner =
    process.env.ROOM_OWNER === "1" &&
    request.nextUrl.searchParams.get("controller") !== "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      origin !== `${request.nextUrl.protocol}//${request.headers.get("host")}`
    )
      return NextResponse.json(
        { error: "Cross-origin changes are not allowed." },
        { status: 403 },
      );
  }
  if ((action === "enable" || action === "disable") && !owner)
    return NextResponse.json(
      { error: "Enable or revoke controls on the display computer." },
      { status: 403 },
    );
  const port = Number(process.env.GATEWAY_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });
  try {
    let body: string | undefined;
    if (request.method === "POST") {
      if (Number(request.headers.get("content-length") ?? 0) > 65536)
        return NextResponse.json(
          { error: "Request too large" },
          { status: 413 },
        );
      const reader = request.body?.getReader();
      let length = 0;
      const decoder = new TextDecoder();
      body = "";
      if (reader)
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 65536) {
            await reader.cancel();
            return NextResponse.json(
              { error: "Request too large" },
              { status: 413 },
            );
          }
          body += decoder.decode(part.value, { stream: true });
        }
      body += decoder.decode();
    }
    const result = await fetch(`http://127.0.0.1:${port}/room/${action}`, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        ...(owner ? { "x-atmosphere-room-owner": "1" } : {}),
        "x-atmosphere-room-token":
          request.cookies.get("atmosphere-room")?.value ?? "",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    const data = await result.json();
    const token = action === "pair" && result.ok ? data.token : undefined;
    if (token) delete data.token;
    const response = NextResponse.json(data, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
    if (token)
      response.cookies.set("atmosphere-room", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 86400 * 7,
      });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Room connection unavailable. Your local settings still work." },
      { status: 503 },
    );
  }
}
export const GET = relay;
export const POST = relay;
