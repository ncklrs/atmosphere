import { createServer as createHttpsServer } from "node:https";
import { request as upstreamRequest } from "node:http";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { X509Certificate } from "node:crypto";
const folder = resolve(process.env.IPAD_TLS_DIR ?? ".data/ipad-tls");
const port = Number(process.env.IPAD_HTTPS_PORT ?? 3443),
  targetPort = Number(process.env.IPAD_WEB_PORT ?? 3211);
if (![port, targetPort].every((n) => Number.isInteger(n) && n > 0 && n < 65536))
  throw new Error("Invalid server port");
const cert = readFileSync(`${folder}/server.pem`),
  ca = readFileSync(`${folder}/ca.pem`);
const leaf = new X509Certificate(cert);
const server = createHttpsServer(
  { key: readFileSync(`${folder}/server.key`), cert, minVersion: "TLSv1.2" },
  (req, res) => {
    const host = req.headers.host ?? "";
    const name = host.split(":")[0];
    if (!name || !(isIP(name) ? leaf.checkIP(name) : leaf.checkHost(name))) {
      res.writeHead(403);
      res.end("Unknown display address");
      return;
    }
    if (req.url === "/ipad-certificate.cer") {
      res.writeHead(200, {
        "Content-Type": "application/pkix-cert",
        "Content-Disposition": "attachment; filename=atmosphere-ipad-ca.cer",
        "Cache-Control": "no-store",
      });
      res.end(new X509Certificate(ca).raw);
      return;
    }
    const {
      connection: _connection,
      upgrade: _upgrade,
      ...headers
    } = req.headers;
    void _connection;
    void _upgrade;
    const upstream = upstreamRequest(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...headers,
          host,
          "x-forwarded-proto": "https",
          "x-forwarded-host": host,
          "x-forwarded-port": String(port),
        },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.setTimeout(15000, () =>
      upstream.destroy(new Error("Upstream timed out")),
    );
    upstream.on("error", () => {
      if (!res.headersSent)
        res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Atmosphere is unavailable. Check the local web server.");
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  },
);
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Atmosphere iPad HTTPS on port ${port} → local web ${targetPort}. CA SHA-256 ${new X509Certificate(ca).fingerprint256}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
