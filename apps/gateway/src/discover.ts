import dgram from "node:dgram";
import { isPrivateIPv4 } from "../../../packages/adapter-wiim/index";
const socket = dgram.createSocket("udp4");
const found = new Set<string>();
socket.on("error", (error) => {
  console.error(error.message);
  socket.close();
  process.exitCode = 1;
});
socket.on("message", (data, info) => {
  const message = data.toString("utf8");
  if (
    !isPrivateIPv4(info.address) ||
    !/wiim|linkplay|MediaRenderer/i.test(message)
  )
    return;
  if (!found.has(info.address)) {
    found.add(info.address);
    console.log(
      `${info.address} · SSDP candidate (validate with WIIM_HOST before trusting)`,
    );
  }
});
socket.bind(0, () => {
  const message = Buffer.from(
    'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n',
  );
  socket.send(message, 1900, "239.255.255.250");
  setTimeout(() => {
    if (!found.size)
      console.log(
        "No candidates. Set WIIM_HOST to the private IPv4 shown in WiiM Home.",
      );
    socket.close();
  }, 3500);
});
