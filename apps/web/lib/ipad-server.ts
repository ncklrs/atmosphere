import { readFile } from "node:fs/promises";
import { X509Certificate } from "node:crypto";
export async function ipadCertificate() {
  const path = process.env.IPAD_CA_CERT;
  if (!path) throw new Error("iPad HTTPS is not configured on this host yet.");
  return new X509Certificate(await readFile(path));
}
export function ipadOrigin() {
  const origin = new URL(process.env.IPAD_HTTPS_ORIGIN ?? "");
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Invalid iPad HTTPS address");
  return origin.origin;
}
