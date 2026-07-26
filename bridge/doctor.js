"use strict";

const { findSclang } = require("./sclang");

const sclang = findSclang();
const nodeMajor = Number(process.versions.node.split(".")[0]);
let failed = false;

console.log("Materialität am Übergang — system check\n");

if (nodeMajor >= 18) {
  console.log(`✓ Node.js ${process.versions.node}`);
} else {
  console.log(`✗ Node.js ${process.versions.node} (version 18 or newer required)`);
  failed = true;
}

if (sclang) {
  console.log(`✓ SuperCollider language: ${sclang}`);
} else {
  console.log("✗ sclang was not found");
  console.log(
    "  Install SuperCollider or set SCLANG_PATH to the sclang executable.",
  );
  failed = true;
}

if (!failed) {
  console.log("\nReady. Run: npm start");
}

process.exitCode = failed ? 1 : 0;
