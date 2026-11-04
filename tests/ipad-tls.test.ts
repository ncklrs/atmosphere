import { it, expect } from "vitest";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { get } from "node:https";
import { X509Certificate } from "node:crypto";
import type { AddressInfo } from "node:net";
it("creates private local-test keys and proxies verified TLS without changing system trust", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atmosphere-ipad-"));
  let child: ChildProcess | undefined;
  const upstream = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        path: req.url,
        proto: req.headers["x-forwarded-proto"],
        host: req.headers.host,
      }),
    );
  });
  const reserve = createServer();
  try {
    const generated = spawnSync(
      process.execPath,
      [resolve("scripts/ipad-cert.mjs"), "192.168.0.162"],
      { cwd: dir, encoding: "utf8" },
    );
    expect(generated.status, generated.stderr).toBe(0);
    const folder = join(dir, ".data/ipad-tls"),
      ca = await readFile(join(folder, "ca.pem")),
      cert = new X509Certificate(await readFile(join(folder, "server.pem")));
    expect(cert.checkIP("192.168.0.162")).toBe("192.168.0.162");
    expect(cert.checkHost("localhost")).toBe("localhost");
    expect((await stat(join(folder, "ca.key"))).mode & 0o777).toBe(0o600);
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    await new Promise<void>((r) => reserve.listen(0, "127.0.0.1", r));
    const port = (reserve.address() as AddressInfo).port;
    await new Promise<void>((r) => reserve.close(() => r()));
    child = spawn(process.execPath, [resolve("scripts/ipad-https.mjs")], {
      cwd: dir,
      env: {
        ...process.env,
        IPAD_TLS_DIR: folder,
        IPAD_HTTPS_PORT: String(port),
        IPAD_WEB_PORT: String((upstream.address() as AddressInfo).port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((resolveReady, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error("TLS proxy did not start")),
        5000,
      );
      child!.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`TLS proxy exited ${code}`));
      });
      child!.stdout!.on("data", (chunk) => {
        output += chunk;
        if (output.includes("HTTPS on port")) {
          clearTimeout(timer);
          resolveReady();
        }
      });
    });
    const request = (path: string, host = `127.0.0.1:${port}`) =>
      new Promise<{ status: number; body: string }>(
        (resolveRequest, reject) => {
          const req = get(
            {
              hostname: "127.0.0.1",
              servername: "localhost",
              port,
              path,
              ca,
              headers: { host },
            },
            (res) => {
              let body = "";
              res.on("data", (c) => (body += c));
              res.on("end", () =>
                resolveRequest({ status: res.statusCode!, body }),
              );
            },
          );
          req.on("error", reject);
        },
      );
    const response = await request("/api/room/state");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      path: "/api/room/state",
      proto: "https",
      host: `127.0.0.1:${port}`,
    });
    expect((await request("/", "unrelated.invalid")).status).toBe(403);
    expect((await request("/", `localhost:${port}`)).status).toBe(200);
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((r) => child!.once("exit", () => r()));
    }
    if (upstream.listening)
      await new Promise<void>((r) => upstream.close(() => r()));
    if (reserve.listening)
      await new Promise<void>((r) => reserve.close(() => r()));
    await rm(dir, { recursive: true, force: true });
  }
}, 15000);
