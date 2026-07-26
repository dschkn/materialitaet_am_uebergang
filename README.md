# Materialität am Übergang

A process-based composition in which a laptop listens to its own internal
activity and turns the conditions of computation into sound.

**Concept and implementation: [dschkn](https://github.com/dschkn)**

## Run

Requirements:

- Node.js 18 or newer
- SuperCollider 3

Check the installation:

```bash
npm run doctor
```

Start the piece with one command:

```bash
npm start
```

On macOS, `start.command` can also be opened directly from Finder. Stop the
piece with `Ctrl+C`.

No npm dependencies are required. The launcher finds `sclang` in the usual
macOS and Linux locations. A custom installation can be selected like this:

```bash
SCLANG_PATH="/path/to/sclang" npm start
```

Keep the output volume low on the first run.

While the piece runs, the terminal becomes a live dashboard. It shows the raw
machine state and the sounding processes produced from it: drone and hum
frequencies, click density, noise brightness, active voices, pulse, drift, and
recent structural changes.

## What happens

The Node.js bridge measures CPU activity, memory, system load, process count,
battery level, and timing instability. Once per second it sends six normalized
values to SuperCollider over OSC.

SuperCollider uses those conditions to shape a field of behaviours:

| Machine condition | Sound behaviour |
|---|---|
| Available CPU headroom | Population of resonant sine voices |
| Memory use | Low drone register and noise brightness |
| System load | Subharmonic beating and resonance relation |
| Running processes | Density of clicks and noise brightness |
| Battery | Slow amplitude pulse |
| Telemetry lag | Irregular frequency drift |

The first prototype deliberately keeps the vocabulary small: low sine pairs,
a subharmonic hum, filtered rumble, pink-noise rustle, short resonant clicks,
and quiet sine objects. The mappings are continuous, so the sound field changes
without turning every telemetry sample into a new note.

The crucial relation is circular. SuperCollider and `scsynth` contribute to
the CPU activity that the bridge measures. When the machine has headroom, the
piece grows more voices; when it becomes busy, the texture thins out. The
computer is therefore not only a source of data or a neutral playback device.
It participates in the conditions from which the form emerges.

Every run is recorded as a local JSONL file in `sessions/`. These files are
ignored by Git by default.

## Theoretical point of departure

The project begins from Luis Küffner's *Materialität am Übergang* and its
discussion of hylomorphic and process-based composition. A hylomorphic model
treats material as something passive onto which a prior form is imposed. A
processual model instead understands form, material, technical environment,
and perception as forces that transform one another while a work comes into
being.

This repository is an independent artistic and technical realization of that
starting idea. It does not reproduce Küffner's SuperCollider examples.
Version 0.1 builds a small, bounded feedback system in which the sounding
result is coupled to the material conditions of its own computation.

The longer conceptual note is in [docs/concept.md](docs/concept.md).

## Project structure

```text
.
├── bridge/             system telemetry, OSC, and process launcher
├── sc/main.scd         SuperCollider sound engine
├── sessions/           local runtime recordings
├── test/               Node.js tests
├── docs/               concept and architecture
├── start.command       double-click launcher for macOS
└── package.json        one-command entry point
```

## Other commands

```bash
npm test
npm run smoke
npm run telemetry
```

- `npm test` runs the bridge unit tests.
- `npm run smoke` collects two fast samples without sound or recording.
- `npm run telemetry` listens to the computer and records a session without
  launching SuperCollider.

## Status

This is the first working prototype. The next stage will add deterministic
session replay and two directly comparable composition modes:

1. **Imposed Form** — fixed mappings and predetermined development.
2. **Co-Individuation** — adaptive relations, thresholds, and feedback.

That comparison will use the same telemetry recording in both modes, making
the difference between an imposed form and an emergent process audible.
