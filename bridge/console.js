#!/usr/bin/env node
"use strict";

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  white: "\x1b[38;5;255m",
  green: "\x1b[38;5;82m",
  yellow: "\x1b[38;5;220m",
  red: "\x1b[38;5;203m",
  purple: "\x1b[38;5;98m",
  blue: "\x1b[38;5;67m",
  gray: "\x1b[38;5;245m",
};

const items = [
  {
    label: "Track 1",
    color: color.gray,
    status: [
      { text: "prepared", color: color.yellow },
      { text: " · ", color: color.gray },
      { text: "stopped", color: color.red },
    ],
  },
  {
    label: "Track 2",
    color: color.gray,
    status: [{ text: "comes later", color: color.purple }],
  },
  {
    label: "Track 3",
    color: color.gray,
    status: [{ text: "comes later", color: color.purple }],
  },
  {
    label: "Track 4",
    color: color.gray,
    status: [{ text: "comes later", color: color.purple }],
  },
  {
    label: "Track 5",
    color: color.gray,
    status: [{ text: "comes later", color: color.purple }],
  },
  { separator: true },
  {
    label: "Channel routing",
    status: [{ text: "planned", color: color.blue }],
    color: color.blue,
  },
  {
    label: "Sound layers",
    status: [{ text: "planned", color: color.blue }],
    color: color.blue,
  },
  {
    label: "Output channels",
    status: [{ text: "planned", color: color.blue }],
    color: color.blue,
  },
  { separator: true },
  { label: "INFO", status: [], color: color.gray },
  { label: "Exit", status: [], color: color.gray },
];

const selectableItems = items
  .map((item, index) => (item.separator ? null : index))
  .filter((index) => index !== null);

let selected = 0;
let note = "Use ↑/↓ and Enter. Press Q or Esc to close.";
let view = "menu";

const infoLines = [
  "HOW TO USE",
  "↑ / ↓       move through the menu",
  "Enter       open or activate an item",
  "Esc         return to the menu",
  "Q           close the live console",
  "",
  "Track controls and SuperCollider parameters will appear here",
  "as the performance system develops. This INFO page will evolve",
  "with every new control and performance mechanism.",
  "",
  "AUTHOR & USE",
  "© 2026 Dmitrii Shchukin / boatbehind.online",
  "Source-available for study, performance, and modification.",
  "Public performances and derivative versions must credit the author.",
  "If you modify the patch, you must notify Dmitrii Shchukin.",
  "See LICENSE.md for the complete terms.",
];

function renderInfo() {
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(`${color.gray}MATERIALITÄT AM ÜBERGANG — INFO${color.reset}\n\n`);
  infoLines.forEach((line) => process.stdout.write(`${color.gray}${line}${color.reset}\n`));
  process.stdout.write(`\n${color.gray}Press Esc, Enter, or Backspace to return. Q closes the console.${color.reset}\n`);
}

function render() {
  if (view === "info") {
    renderInfo();
    return;
  }
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
    const status = item.status
      .map(({ text, color: statusColor }) => `${statusColor}${text}`)
      .join("");
    process.stdout.write(
      `${color.white}${marker} ${item.color}${item.label.padEnd(22)} ${status}${color.reset}\n`,
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

  if (item.label === "INFO") {
    view = "info";
    render();
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
    if (key === "\u0003" || key === "q" || key === "Q") {
      close();
      return;
    }
    if (view === "info") {
      if (key === "\u001b" || key === "\r" || key === "\n" || key === "\u007f" || key === "\b") {
        view = "menu";
        note = "Use ↑/↓ and Enter. Press Q or Esc to close.";
        render();
      }
      return;
    }
    if (key === "\u001b") {
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
