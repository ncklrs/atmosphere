import { NextResponse } from "next/server";
import { ipadCertificate, ipadOrigin } from "../../../../lib/ipad-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const certificate = await ipadCertificate();
    return NextResponse.json(
      {
        origin: ipadOrigin(),
        fingerprint: certificate.fingerprint256,
        expires: certificate.validTo,
        certificateUrl: "/api/ipad/certificate",
        name: "Atmosphere iPad Local Test CA",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "iPad HTTPS is not configured on this host yet." },
      { status: 503 },
    );
  }
}
