# Architecture

## Runtime

```text
operating system
      │
      ▼
Node.js telemetry bridge ── OSC/UDP ──▶ SuperCollider
      │                                   │
      └──── JSONL session log             └── audio + DSP load
                     ▲                              │
                     └──────── next measurement ◀──┘
```

The root command `npm start` launches both runtime components. Node.js keeps
ownership of the process lifecycle: `Ctrl+C` closes the recorder, UDP socket,
and `sclang` child process.

## OSC protocol

The bridge sends one message per sampling interval:

```text
/materiality/system ,ffffff
cpu memory load processes battery lag
```

Every value is normalized to the range `0.0` through `1.0`.

| Field | Source | Musical influence |
|---|---|---|
| `cpu` | Change in aggregate CPU time | Voice population and damping |
| `memory` | Used / total memory | Fundamental register and brightness |
| `load` | One-minute load / CPU cores | Detuning and resonance relation |
| `processes` | Number of OS processes | Event density and brightness |
| `battery` | Battery percentage | Slow pulse |
| `lag` | Telemetry timer delay | Modulation irregularity |

If battery data is unavailable, the bridge sends the neutral value `0.5`.

## Session format

Each run writes newline-delimited JSON to `sessions/`. A line contains the
timestamp, raw readings, and normalized values used by the audio engine.
Generated session files are ignored by Git so that private machine data is not
published accidentally.
