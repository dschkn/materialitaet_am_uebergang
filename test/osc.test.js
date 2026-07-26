"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeOscMessage, encodeOscString } = require("../bridge/osc");

test("OSC strings are null-terminated and padded to four bytes", () => {
  const value = encodeOscString("/cpu");

  assert.equal(value.length % 4, 0);
  assert.equal(value.subarray(0, 5).toString("utf8"), "/cpu\0");
});

test("OSC messages encode address, float tags, and float values", () => {
  const packet = encodeOscMessage("/materiality/system", [0.25, 0.75]);
  const addressLength = encodeOscString("/materiality/system").length;
  const tagsLength = encodeOscString(",ff").length;

  assert.equal(
    packet.subarray(0, addressLength).toString("utf8").replace(/\0+$/, ""),
    "/materiality/system",
  );
  assert.equal(
    packet
      .subarray(addressLength, addressLength + tagsLength)
      .toString("utf8")
      .replace(/\0+$/, ""),
    ",ff",
  );
  assert.ok(
    Math.abs(packet.readFloatBE(addressLength + tagsLength) - 0.25) < 0.0001,
  );
  assert.ok(
    Math.abs(packet.readFloatBE(addressLength + tagsLength + 4) - 0.75) <
      0.0001,
  );
});

test("OSC messages reject invalid addresses", () => {
  assert.throws(
    () => encodeOscMessage("materiality/system", []),
    /beginning with/ ,
  );
});
