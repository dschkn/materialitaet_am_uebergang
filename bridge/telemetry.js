"use strict";

const os = require("node:os");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function clamp(value, minimum = 0, maximum = 1) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(value, minimum, maximum) {
  if (maximum <= minimum) {
    throw new RangeError("maximum must be greater than minimum");
  }
  return clamp((value - minimum) / (maximum - minimum));
}

function cpuSnapshot(cpus = os.cpus()) {
  return cpus.reduce(
    (snapshot, cpu) => {
      const total = Object.values(cpu.times).reduce(
        (sum, milliseconds) => sum + milliseconds,
        0,
      );
      snapshot.idle += cpu.times.idle;
      snapshot.total += total;
      return snapshot;
    },
    { idle: 0, total: 0 },
  );
}

function calculateCpuLoad(previous, current) {
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;

  if (totalDelta <= 0) {
    return 0;
  }

  return clamp(1 - idleDelta / totalDelta);
}

async function readProcessCount() {
  try {
    const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid="], {
      maxBuffer: 1024 * 1024,
    });
    return stdout.split("\n").filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

async function readMacBattery() {
  try {
    const { stdout } = await execFileAsync("pmset", ["-g", "batt"]);
    const match = stdout.match(/(\d+)%/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function readLinuxBattery() {
  const base = "/sys/class/power_supply";

  try {
    const entries = await fs.readdir(base);
    const battery = entries.find((entry) => entry.startsWith("BAT"));
    if (!battery) {
      return null;
    }

    const value = await fs.readFile(path.join(base, battery, "capacity"), "utf8");
    const percentage = Number(value.trim());
    return Number.isFinite(percentage) ? percentage : null;
  } catch {
    return null;
  }
}

async function readBatteryPercent(platform = process.platform) {
  if (platform === "darwin") {
    return readMacBattery();
  }
  if (platform === "linux") {
    return readLinuxBattery();
  }
  return null;
}

class TelemetrySampler {
  constructor() {
    this.previousCpu = cpuSnapshot();
    this.cpuCount = Math.max(1, os.cpus().length);
  }

  async sample(eventLoopLagMs = 0) {
    const currentCpu = cpuSnapshot();
    const cpu = calculateCpuLoad(this.previousCpu, currentCpu);
    this.previousCpu = currentCpu;

    const [processCount, batteryPercent] = await Promise.all([
      readProcessCount(),
      readBatteryPercent(),
    ]);

    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - os.freemem();
    const loadAverage = os.loadavg()[0];

    return {
      timestamp: new Date().toISOString(),
      raw: {
        cpu,
        usedMemoryBytes: usedMemory,
        totalMemoryBytes: totalMemory,
        loadAverage,
        cpuCount: this.cpuCount,
        processCount,
        batteryPercent,
        eventLoopLagMs,
      },
      normalized: {
        cpu,
        memory: clamp(usedMemory / totalMemory),
        load: clamp(loadAverage / this.cpuCount),
        processes: normalize(processCount, 40, 500),
        battery:
          batteryPercent === null ? 0.5 : clamp(batteryPercent / 100),
        lag: normalize(eventLoopLagMs, 0, 200),
      },
    };
  }
}

module.exports = {
  TelemetrySampler,
  calculateCpuLoad,
  clamp,
  cpuSnapshot,
  normalize,
  readBatteryPercent,
  readProcessCount,
};
