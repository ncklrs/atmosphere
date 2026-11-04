import { mkdirSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { isIP } from "node:net";
process.umask(0o077);
const address = process.argv[2];
if (
  !address ||
  isIP(address) !== 4 ||
  !/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(address)
)
  throw new Error("Provide this computer's private Wi-Fi IPv4 address.");
const folder = resolve(".data/ipad-tls");
mkdirSync(folder, { recursive: true, mode: 0o700 });
chmodSync(folder, 0o700);
const run = (args) => {
  const result = spawnSync("openssl", args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      `Certificate setup failed: ${result.stderr.slice(0, 1000)}`,
    );
  return result.stdout;
};
const existing = existsSync(`${folder}/ca.key`);
if (existing && !process.argv.includes("--renew"))
  throw new Error(
    "A test CA already exists. Reuse it; do not overwrite an installed trust authority.",
  );
if (!existing) {
  const config = `[req]\ndistinguished_name=dn\nx509_extensions=ca\nprompt=no\n[dn]\nCN=Atmosphere iPad Local Test CA\n[ca]\nbasicConstraints=critical,CA:true,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n`;
  writeFileSync(`${folder}/ca.cnf`, config, { mode: 0o600 });
  run([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "30",
    "-sha256",
    "-keyout",
    `${folder}/ca.key`,
    "-out",
    `${folder}/ca.pem`,
    "-config",
    `${folder}/ca.cnf`,
  ]);
}
run([
  "req",
  "-new",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  `${folder}/server.key`,
  "-out",
  `${folder}/server.csr`,
  "-subj",
  "/CN=Atmosphere iPad Display",
]);
writeFileSync(
  `${folder}/server.ext`,
  `basicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:${address},IP:127.0.0.1,DNS:localhost\n`,
  { mode: 0o600 },
);
run([
  "x509",
  "-req",
  "-in",
  `${folder}/server.csr`,
  "-CA",
  `${folder}/ca.pem`,
  "-CAkey",
  `${folder}/ca.key`,
  "-CAcreateserial",
  "-out",
  `${folder}/server.pem`,
  "-days",
  "7",
  "-sha256",
  "-extfile",
  `${folder}/server.ext`,
]);
run([
  "x509",
  "-in",
  `${folder}/ca.pem`,
  "-outform",
  "DER",
  "-out",
  `${folder}/atmosphere-ipad-ca.cer`,
]);
for (const file of ["ca.key", "server.key"])
  chmodSync(`${folder}/${file}`, 0o600);
console.log(
  run([
    "x509",
    "-in",
    `${folder}/ca.pem`,
    "-noout",
    "-fingerprint",
    "-sha256",
  ]).trim(),
);
console.log(
  `Test certificate created for ${address}. Private keys stay in .data/ipad-tls. No system trust settings changed.`,
);
