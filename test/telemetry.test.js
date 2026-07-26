"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateCpuLoad,
  clamp,
  normalize,
} = require("../bridge/telemetry");

test("clamp keeps values inside a range", () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(0.4), 0.4);
  assert.equal(clamp(5), 1);
});

test("normalize maps a measured interval to zero through one", () => {
  assert.equal(normalize(40, 40, 500), 0);
  assert.equal(normalize(500, 40, 500), 1);
  assert.equal(normalize(270, 40, 500), 0.5);
});

test("calculateCpuLoad measures non-idle time between snapshots", () => {
  const previous = { idle: 100, total: 200 };
  const current = { idle: 130, total: 300 };

  assert.equal(calculateCpuLoad(previous, current), 0.7);
});
