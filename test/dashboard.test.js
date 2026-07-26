"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFrame,
  deriveSoundState,
  describeChanges,
  engineStatusFromLine,
} = require("../bridge/dashboard");

function sample(overrides = {}) {
  return {
    normalized: {
      cpu: 0.2,
      memory: 0.75,
      load: 0.4,
      processes: 0.5,
      battery: 0.8,
      lag: 0.1,
      ...overrides,
    },
    raw: {
      loadAverage: 3.2,
      cpuCount: 8,
      processCount: 270,
      eventLoopLagMs: 4,
      batteryPercent: 80,
      usedMemoryBytes: 12 * 1024 ** 3,
      totalMemoryBytes: 16 * 1024 ** 3,
    },
  };
}

test("sound state mirrors the SuperCollider telemetry mappings", () => {
  const sound = deriveSoundState(sample());

  assert.equal(sound.voices, 5);
  assert.equal(sound.maxVoices, 6);
  assert.ok(Math.abs(sound.clickRate - 3.65) < 0.0001);
  assert.ok(Math.abs(sound.rustleHz - 5220) < 0.0001);
  assert.equal(sound.clickDensity, "active");
});

test("musical changes report population and process-density transitions", () => {
  const previous = deriveSoundState(sample({ cpu: 0.8, processes: 0 }));
  const current = deriveSoundState(sample({ cpu: 0.1, processes: 0.9 }));
  const changes = describeChanges(previous, current).join("\n");

  assert.match(changes, /voices 2 -> 6/);
  assert.match(changes, /clicks sparse -> dense/);
});

test("dashboard frame contains system metrics and sounding processes", () => {
  const currentSample = sample();
  const sound = deriveSoundState(currentSample);
  const frame = createFrame({
    sample: currentSample,
    sound,
    engine: { phase: "online", detail: "synthesis field receiving telemetry" },
    events: ["telemetry linked to synthesis"],
    port: 57121,
    session: "sessions/example.jsonl",
  });

  assert.match(frame, /CPU/);
  assert.match(frame, /MEMORY/);
  assert.match(frame, /PROCESSES 270/);
  assert.match(frame, /DRONE/);
  assert.match(frame, /CLICKS/);
  assert.match(frame, /RUSTLE/);
  assert.match(frame, /VOICES/);
});

test("SuperCollider diagnostics promote engine readiness and errors", () => {
  assert.deepEqual(
    engineStatusFromLine("Materialität audio engine online — OSC port 57121."),
    { phase: "online", detail: "synthesis field receiving telemetry" },
  );
  assert.deepEqual(
    engineStatusFromLine("SynthDef materialityVoice build failed"),
    { phase: "error", detail: "SynthDef materialityVoice build failed" },
  );
});
