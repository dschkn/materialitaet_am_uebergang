"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArguments } = require("../bridge/index");

test("CLI uses live audio and recording by default", () => {
  const options = parseArguments([]);

  assert.equal(options.audio, true);
  assert.equal(options.record, true);
  assert.equal(options.port, 57121);
  assert.equal(options.interval, 1000);
});

test("CLI accepts bounded test and telemetry options", () => {
  const options = parseArguments([
    "--no-audio",
    "--no-record",
    "--samples",
    "3",
    "--interval",
    "250",
    "--port",
    "6000",
  ]);

  assert.deepEqual(options, {
    audio: false,
    record: false,
    samples: 3,
    interval: 250,
    port: 6000,
    help: false,
  });
});

test("CLI rejects unknown options", () => {
  assert.throws(() => parseArguments(["--mystery"]), /Unknown option/);
});
