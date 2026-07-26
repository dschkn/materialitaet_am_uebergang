"use strict";

function encodeOscString(value) {
  const source = Buffer.from(`${value}\0`, "utf8");
  const padding = (4 - (source.length % 4)) % 4;
  return Buffer.concat([source, Buffer.alloc(padding)]);
}

function encodeOscArgument(value) {
  if (typeof value === "number") {
    const data = Buffer.alloc(4);
    data.writeFloatBE(value, 0);
    return { tag: "f", data };
  }

  if (typeof value === "string") {
    return { tag: "s", data: encodeOscString(value) };
  }

  throw new TypeError(`Unsupported OSC argument: ${typeof value}`);
}

function encodeOscMessage(address, values) {
  if (typeof address !== "string" || !address.startsWith("/")) {
    throw new TypeError("An OSC address must be a string beginning with '/'.");
  }

  const encoded = values.map(encodeOscArgument);
  const tags = encodeOscString(`,${encoded.map(({ tag }) => tag).join("")}`);

  return Buffer.concat([
    encodeOscString(address),
    tags,
    ...encoded.map(({ data }) => data),
  ]);
}

function sendOscMessage(socket, host, port, address, values) {
  const packet = encodeOscMessage(address, values);

  return new Promise((resolve, reject) => {
    socket.send(packet, port, host, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

module.exports = {
  encodeOscMessage,
  encodeOscString,
  sendOscMessage,
};
