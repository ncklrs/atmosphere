import { startGateway } from "./server";
const port = Number(process.env.GATEWAY_PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid GATEWAY_PORT");
const gateway = await startGateway({
  port,
  origin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000",
  lyrics: process.env.LYRICS_PROVIDER === "lrclib",
  wiim: process.env.WIIM_HOST
    ? {
        host: process.env.WIIM_HOST,
        allowSelfSigned: process.env.WIIM_ALLOW_SELF_SIGNED === "true",
      }
    : undefined,
});
console.log(
  `Atmosphere gateway http://127.0.0.1:${gateway.port} · ${process.env.WIIM_HOST ? "WiiM" : "offline demo"}`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void gateway.close().then(() => process.exit(0));
  });
