"use strict";

const { clamp } = require("./telemetry");

const FRAME_WIDTH = 84;
const MAX_VOICES = 6;

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function formatPercent(value) {
  return `${Math.round(clamp(value) * 100)}%`;
}

function formatBytes(value) {
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatStatus(sample) {
  const { normalized, raw } = sample;

  return [
    `CPU ${formatPercent(normalized.cpu).padStart(4)}`,
    `MEM ${formatPercent(normalized.memory).padStart(4)}`,
    `LOAD ${formatPercent(normalized.load).padStart(4)}`,
    `PROC ${String(raw.processCount).padStart(3)}`,
    `LAG ${String(Math.round(raw.eventLoopLagMs)).padStart(3)}ms`,
  ].join("  ");
}

function deriveSoundState(sample) {
  const metrics = sample.normalized;
  const droneHz = midiToHz(28 + metrics.memory * 12);
  const clickRate = 0.25 + metrics.processes * 6 + metrics.cpu * 2;

  return {
    voices: Math.round(1 + (1 - metrics.cpu) * (MAX_VOICES - 1)),
    maxVoices: MAX_VOICES,
    droneHz,
    humHz: droneHz * (0.48 + metrics.load * 0.08),
    clickRate,
    clickDensity:
      clickRate < 2 ? "sparse" : clickRate < 5 ? "active" : "dense",
    rustleHz: 220 + metrics.memory * 5200 + metrics.processes * 2200,
    pulseHz: 0.025 + metrics.battery * 0.12,
    driftHz: 0.025 + metrics.lag * 0.45,
  };
}

function describeChanges(previous, current) {
  if (!previous) {
    return [
      "telemetry linked to synthesis",
      `${current.voices} voices entered the field`,
      `${current.clickDensity} click process initialized`,
    ];
  }

  const changes = [];

  if (previous.voices !== current.voices) {
    changes.push(
      current.voices > previous.voices
        ? `CPU headroom grew: voices ${previous.voices} -> ${current.voices}`
        : `CPU pressure rose: voices ${previous.voices} -> ${current.voices}`,
    );
  }

  if (previous.clickDensity !== current.clickDensity) {
    changes.push(
      `process activity: clicks ${previous.clickDensity} -> ${current.clickDensity}`,
    );
  }

  if (Math.abs(previous.droneHz - current.droneHz) >= 1.5) {
    changes.push(
      `memory changed the drone: ${previous.droneHz.toFixed(1)} -> ${current.droneHz.toFixed(1)} Hz`,
    );
  }

  if (Math.abs(previous.rustleHz - current.rustleHz) >= 800) {
    changes.push(
      current.rustleHz > previous.rustleHz
        ? "the noise field brightened"
        : "the noise field darkened",
    );
  }

  return changes;
}

function engineStatusFromLine(line) {
  if (
    /ERROR:|SynthDef .* failed|could not initialize audio|terminating|exception/i.test(
      line,
    )
  ) {
    return { phase: "error", detail: line };
  }

  if (/Materialität audio engine online/i.test(line)) {
    return { phase: "online", detail: "synthesis field receiving telemetry" };
  }

  if (/SuperCollider 3 server ready/i.test(line)) {
    return { phase: "starting", detail: "audio server ready; building synths" };
  }

  if (/compiling class library/i.test(line)) {
    return { phase: "starting", detail: "compiling SuperCollider class library" };
  }

  return null;
}

function bar(value, length = 18) {
  const filled = Math.round(clamp(value) * length);
  return `${"█".repeat(filled)}${"░".repeat(length - filled)}`;
}

function fit(value, width) {
  const text = String(value);

  if (text.length > width) {
    return `${text.slice(0, Math.max(0, width - 1))}…`;
  }

  return text.padEnd(width);
}

function row(value = "") {
  return `│${fit(` ${value}`, FRAME_WIDTH - 2)}│`;
}

function divider(label) {
  const prefix = `├─ ${label} `;
  return `${prefix}${"─".repeat(FRAME_WIDTH - prefix.length - 1)}┤`;
}

function createFrame({ sample, sound, engine, events, port, session }) {
  const lines = [
    `┌${"─".repeat(FRAME_WIDTH - 2)}┐`,
    row("MATERIALITÄT AM ÜBERGANG  /  SYSTEM LISTENING"),
    divider("ENGINE"),
    row(
      `${engine.phase.toUpperCase().padEnd(8)} ${engine.detail}  ·  OSC 127.0.0.1:${port}`,
    ),
  ];

  if (!sample || !sound) {
    lines.push(
      divider("SYSTEM"),
      row("waiting for the first telemetry sample..."),
      divider("SESSION"),
      row(session),
      row("Ctrl+C to stop"),
      `└${"─".repeat(FRAME_WIDTH - 2)}┘`,
    );
    return lines.join("\n");
  }

  const { normalized, raw } = sample;
  const battery =
    raw.batteryPercent === null ? "n/a" : `${raw.batteryPercent}%`;

  lines.push(
    divider("SYSTEM"),
    row(
      `CPU    [${bar(normalized.cpu)}] ${formatPercent(normalized.cpu).padStart(4)}    ` +
        `MEMORY [${bar(normalized.memory)}] ${formatPercent(normalized.memory).padStart(4)}`,
    ),
    row(
      `LOAD   ${raw.loadAverage.toFixed(2)} / ${raw.cpuCount} cores (${formatPercent(normalized.load)})` +
        `    PROCESSES ${raw.processCount}    LAG ${Math.round(raw.eventLoopLagMs)} ms`,
    ),
    row(
      `MEMORY ${formatBytes(raw.usedMemoryBytes)} / ${formatBytes(raw.totalMemoryBytes)}` +
        `    BATTERY ${battery}`,
    ),
    divider("SOUND FIELD"),
    row(
      `DRONE   ${sound.droneHz.toFixed(1).padStart(6)} Hz   low sine pair` +
        `             memory -> register`,
    ),
    row(
      `HUM     ${sound.humHz.toFixed(1).padStart(6)} Hz   subharmonic + rumble` +
        `        load -> beating`,
    ),
    row(
      `CLICKS  ${sound.clickRate.toFixed(1).padStart(6)} /s   ${sound.clickDensity.padEnd(6)} impulses` +
        `             processes -> density`,
    ),
    row(
      `RUSTLE  ${(sound.rustleHz / 1000).toFixed(1).padStart(6)} kHz  filtered pink noise` +
        `          memory/processes -> brightness`,
    ),
    row(
      `VOICES  ${String(sound.voices).padStart(6)} / ${sound.maxVoices}   resonant sine objects` +
        `         CPU headroom -> population`,
    ),
    row(
      `MOTION  pulse ${sound.pulseHz.toFixed(2)} Hz  drift ${sound.driftHz.toFixed(2)} Hz` +
        `          battery/lag -> movement`,
    ),
    divider("RECENT MUSICAL CHANGES"),
  );

  const visibleEvents = events.slice(-3);
  while (visibleEvents.length < 3) {
    visibleEvents.unshift("field adapting continuously");
  }
  for (const event of visibleEvents) {
    lines.push(row(`• ${event}`));
  }

  lines.push(
    divider("SESSION"),
    row(session),
    row("Ctrl+C to stop  ·  keep the output volume modest"),
    `└${"─".repeat(FRAME_WIDTH - 2)}┘`,
  );

  return lines.join("\n");
}

class TerminalDashboard {
  constructor({ stream, port, session, audio }) {
    this.stream = stream;
    this.port = port;
    this.session = session;
    this.interactive = Boolean(stream.isTTY);
    this.sample = null;
    this.sound = null;
    this.previousSound = null;
    this.events = [];
    this.engine = audio
      ? { phase: "starting", detail: "waiting for SuperCollider" }
      : { phase: "disabled", detail: "telemetry only" };
    this.active = true;

    if (this.interactive) {
      this.stream.write("\x1b[?1049h\x1b[?25l");
      this.render();
    } else {
      this.stream.write(`Session: ${session}\n`);
      this.stream.write(
        audio ? `OSC: 127.0.0.1:${port}\n` : "Audio: disabled\n",
      );
    }
  }

  setEngine(engine) {
    this.engine = engine;
    this.render();
  }

  update(sample) {
    this.sample = sample;
    this.sound = deriveSoundState(sample);
    const changes = describeChanges(this.previousSound, this.sound);

    if (changes.length > 0) {
      this.events.push(...changes);
      this.events = this.events.slice(-8);
    }

    this.previousSound = this.sound;
    this.render();
  }

  render() {
    if (!this.active) {
      return;
    }

    if (this.interactive) {
      const frame = createFrame({
        sample: this.sample,
        sound: this.sound,
        engine: this.engine,
        events: this.events,
        port: this.port,
        session: this.session,
      });
      this.stream.write(`\x1b[H\x1b[2J${frame}`);
    } else if (this.sample) {
      this.stream.write(`\r${formatStatus(this.sample)}`);
    }
  }

  stop(message) {
    if (!this.active) {
      return;
    }
    this.active = false;

    if (this.interactive) {
      this.stream.write("\x1b[?25h\x1b[?1049l");
    } else {
      this.stream.write("\n");
    }

    this.stream.write(`${message}\n`);
    if (this.engine.phase === "error") {
      this.stream.write(`Engine: ${this.engine.detail}\n`);
    }
  }
}

module.exports = {
  TerminalDashboard,
  createFrame,
  deriveSoundState,
  describeChanges,
  engineStatusFromLine,
  formatStatus,
};
