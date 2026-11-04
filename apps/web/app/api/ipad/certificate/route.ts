import { randomUUID } from "node:crypto";
import { ipadCertificate } from "../../../../lib/ipad-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const cert = await ipadCertificate();
    const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
 <key>PayloadType</key><string>Configuration</string><key>PayloadVersion</key><integer>1</integer><key>PayloadIdentifier</key><string>local.atmosphere.ipad-test</string><key>PayloadUUID</key><string>${randomUUID()}</string><key>PayloadDisplayName</key><string>Atmosphere iPad HTTPS Test</string><key>PayloadDescription</key><string>Local Atmosphere test certificate. Installing this adds a certificate authority to this iPad. Remove this profile after the test if no longer needed.</string><key>PayloadRemovalDisallowed</key><false/>
 <key>PayloadContent</key><array><dict><key>PayloadType</key><string>com.apple.security.root</string><key>PayloadVersion</key><integer>1</integer><key>PayloadIdentifier</key><string>local.atmosphere.ipad-test.root</string><key>PayloadUUID</key><string>${randomUUID()}</string><key>PayloadDisplayName</key><string>Atmosphere iPad Local Test CA</string><key>PayloadCertificateFileName</key><string>atmosphere-ipad-ca.cer</string><key>PayloadContent</key><data>${cert.raw.toString("base64")}</data></dict></array></dict></plist>`;
    return new Response(xml, {
      headers: {
        "Content-Type": "application/x-apple-aspen-config",
        "Content-Disposition":
          "attachment; filename=atmosphere-ipad-test.mobileconfig",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "The iPad test certificate is not available." },
      { status: 503 },
    );
  }
}
