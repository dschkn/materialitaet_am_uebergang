#!/usr/bin/env node
"use strict";

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  white: "\x1b[38;5;255m",
  yellow: "\x1b[38;5;220m",
  purple: "\x1b[38;5;98m",
  blue: "\x1b[38;5;67m",
  gray: "\x1b[38;5;245m",
};

const items = [
  { label: "Track 1", status: "ready · stopped", color: color.yellow },
  { label: "Track 2", status: "comes later", color: color.purple },
  { label: "Track 3", status: "comes later", color: color.purple },
  { label: "Track 4", status: "comes later", color: color.purple },
  { label: "Track 5", status: "comes later", color: color.purple },
  { separator: true },
  { label: "Channel routing", status: "planned", color: color.blue },
  { label: "Sound layers", status: "planned", color: color.blue },
  { label: "Output channels", status: "planned", color: color.blue },
  { separator: true },
  { label: "Exit", status: "", color: color.gray },
];

const selectableItems = items
  .map((item, index) => (item.separator ? null : index))
  .filter((index) => index !== null);

let selected = 0;
let note = "Use ↑/↓ and Enter. Press Q or Esc to close.";

function render() {
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(
    `${color.bold}${color.white}MATERIALITÄT AM ÜBERGANG${color.reset}\n`,
  );
  process.stdout.write(`${color.gray}LIVE CONSOLE${color.reset}\n\n`);

  items.forEach((item, index) => {
    if (item.separator) {
      process.stdout.write("\n");
      return;
    }

    const marker = index === selected ? "›" : " ";
    process.stdout.write(
      `${item.color}${marker} ${item.label.padEnd(22)} ${item.status}${color.reset}\n`,
    );
  });

  process.stdout.write(`\n${color.gray}${note}${color.reset}\n`);
}

function close() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
  process.stdout.write("\x1b[2J\x1b[H");
}

function select() {
  const item = items[selected];

  if (item.label === "Exit") {
    close();
    return;
  }

  note =
    item.label === "Track 1"
      ? "Track 1 is ready. Live controls will be connected here later."
      : `${item.label} will be designed for a future performance version.`;
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
      const position = selectableItems.indexOf(selected);
      selected = selectableItems[
        (position - 1 + selectableItems.length) % selectableItems.length
      ];
      render();
      return;
    }
    if (key === "\u001b[B") {
      const position = selectableItems.indexOf(selected);
      selected = selectableItems[(position + 1) % selectableItems.length];
      render();
      return;
    }
    if (key === "\r" || key === "\n") {
      select();
    }
  });

  render();
}
