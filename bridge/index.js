#!/usr/bin/env node
"use strict";

const dgram = require("node:dgram");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TelemetrySampler, clamp } = require("./telemetry");
const { sendOscMessage } = require("./osc");
const { findSclang } = require("./sclang");

const DEFAULT_PORT = 57121;
const DEFAULT_INTERVAL = 1000;

function usage() {
  return `
Materialität am Übergang

Usage:
  npm start
  node bridge/index.js [options]

Options:
  --no-audio       Collect telemetry without launching SuperCollider
  --no-record      Do not write a JSONL session file
  --samples N      Stop after N telemetry samples
  --interval MS    Sampling interval in milliseconds (minimum: 100)
  --port PORT      OSC receive port used by SuperCollider
  --help            Show this help
`.trim();
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${flag} expects a positive integer.`);
  }
  return parsed;
}

function parseArguments(argv) {
  const options = {
    audio: true,
    record: true,
    samples: null,
    interval: DEFAULT_INTERVAL,
    port: DEFAULT_PORT,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--no-audio":
        options.audio = false;
        break;
      case "--no-record":
        options.record = false;
        break;
      case "--samples":
        options.samples = positiveInteger(argv[++index], "--samples");
        break;
      case "--interval":
        options.interval = Math.max(
          100,
          positiveInteger(argv[++index], "--interval"),
        );
        break;
      case "--port":
        options.port = positiveInteger(argv[++index], "--port");
        if (options.port > 65535) {
          throw new RangeError("--port must be between 1 and 65535.");
        }
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new TypeError(`Unknown option: ${argument}`);
    }
  }

  return options;
}

function sessionFileName() {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
}

function formatPercent(value) {
  return `${Math.round(clamp(value) * 100)
    .toString()
    .padStart(3)}%`;
}

function formatStatus(sample) {
  const { normalized } = sample;
  const processCount = sample.raw.processCount.toString().padStart(3);

  return [
    `CPU ${formatPercent(normalized.cpu)}`,
    `MEM ${formatPercent(normalized.memory)}`,
    `LOAD ${formatPercent(normalized.load)}`,
    `PROC ${processCount}`,
    `LAG ${Math.round(sample.raw.eventLoopLagMs).toString().padStart(3)}ms`,
  ].join("  ");
}

function launchSuperCollider(projectRoot, port) {
  const sclang = findSclang();
  if (!sclang) {
    throw new Error(
      "sclang was not found. Install SuperCollider or set SCLANG_PATH. Run `npm run doctor` for details.",
    );
  }

  const script = path.join(projectRoot, "sc", "main.scd");
  const child = spawn(sclang, [script], {
    cwd: projectRoot,
    env: {
      ...process.env,
      MATERIALITY_OSC_PORT: String(port),
    },
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Could not start SuperCollider: ${error.message}`);
  });

  return child;
}

async function run(options) {
  const projectRoot = path.resolve(__dirname, "..");
  const sampler = new TelemetrySampler();
  const socket = dgram.createSocket("udp4");
  const sessionDirectory = path.join(projectRoot, "sessions");
  let recorder = null;
  let superCollider = null;
  let timer = null;
  let sampleCount = 0;
  let expectedSampleTime = Date.now() + options.interval;
  let sampling = false;
  let stopping = false;

  if (options.record) {
    fs.mkdirSync(sessionDirectory, { recursive: true });
    const sessionPath = path.join(sessionDirectory, sessionFileName());
    recorder = fs.createWriteStream(sessionPath, { encoding: "utf8" });
    console.log(`Session: ${path.relative(projectRoot, sessionPath)}`);
  }

  if (options.audio) {
    superCollider = launchSuperCollider(projectRoot, options.port);
    console.log(`OSC: 127.0.0.1:${options.port}`);
  } else {
    console.log("Audio: disabled");
  }

  const stop = (exitCode = 0) => {
    if (stopping) {
      return;
    }
    stopping = true;

    if (timer) {
      clearInterval(timer);
    }

    process.stdout.write("\n");
    socket.close();

    if (recorder) {
      recorder.end();
    }

    if (superCollider && !superCollider.killed) {
      superCollider.kill("SIGTERM");
    }

    process.exitCode = exitCode;
  };

  if (superCollider) {
    superCollider.on("exit", (code, signal) => {
      if (!stopping) {
        console.error(
          `\nSuperCollider stopped unexpectedly (${signal || code}).`,
        );
        stop(1);
      }
    });
  }

  process.once("SIGINT", () => stop(0));
  process.once("SIGTERM", () => stop(0));

  const tick = async () => {
    if (sampling || stopping) {
      return;
    }
    sampling = true;

    try {
      const now = Date.now();
      const lag = Math.max(0, now - expectedSampleTime);
      expectedSampleTime = now + options.interval;
      const sample = await sampler.sample(lag);

      if (recorder) {
        recorder.write(`${JSON.stringify(sample)}\n`);
      }

      if (options.audio) {
        const metrics = sample.normalized;
        await sendOscMessage(
          socket,
          "127.0.0.1",
          options.port,
          "/materiality/system",
          [
            metrics.cpu,
            metrics.memory,
            metrics.load,
            metrics.processes,
            metrics.battery,
            metrics.lag,
          ],
        );
      }

      sampleCount += 1;
      process.stdout.write(`\r${formatStatus(sample)}`);

      if (options.samples !== null && sampleCount >= options.samples) {
        stop(0);
      }
    } catch (error) {
      console.error(`\nTelemetry error: ${error.message}`);
      stop(1);
    } finally {
      sampling = false;
    }
  };

  console.log("Listening to the machine. Press Ctrl+C to stop.\n");
  await tick();

  if (!stopping) {
    timer = setInterval(tick, options.interval);
  }
}

async function main() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error("\nRun with --help to see available options.");
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  try {
    await run(options);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  formatStatus,
  parseArguments,
  positiveInteger,
  usage,
};
