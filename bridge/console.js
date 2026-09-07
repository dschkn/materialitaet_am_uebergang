#!/usr/bin/env node
"use strict";

const items = [
  "Track 1",
  "Channel routing",
  "Sound layers",
  "Output channels",
  "Exit",
];

let selected = 0;
let note = "Use ↑/↓ and Enter. Press Q or Esc to close.";

function render() {
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write("MATERIALITÄT AM ÜBERGANG\n");
  process.stdout.write("LIVE CONSOLE\n\n");

  items.forEach((item, index) => {
    const marker = index === selected ? "›" : " ";
    const status = index === 0 ? "ready" : index === items.length - 1 ? "" : "planned";
    process.stdout.write(`${marker} ${item.padEnd(22)} ${status}\n`);
  });

  process.stdout.write(`\n${note}\n`);
}

function close() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
  process.stdout.write("\x1b[2J\x1b[H");
}

function select() {
  if (selected === items.length - 1) {
    close();
    return;
  }

  note =
    selected === 0
      ? "Track 1 is ready. Live controls will be connected here later."
      : `${items[selected]} will be designed for a future performance version.`;
  render();
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.log("The live console requires an interactive terminal.");
  process.exitCode = 1;
} else {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  process.stdin.on("data", (key) => {
    if (key === "\u0003" || key === "q" || key === "Q" || key === "\u001b") {
      close();
      return;
    }
    if (key === "\u001b[A") {
      selected = (selected - 1 + items.length) % items.length;
      render();
      return;
    }
    if (key === "\u001b[B") {
      selected = (selected + 1) % items.length;
      render();
      return;
    }
    if (key === "\r" || key === "\n") {
      select();
    }
  });

  render();
}
