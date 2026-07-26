"use strict";

const fs = require("node:fs");
const path = require("node:path");

function isExecutable(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findOnPath(command, environmentPath = process.env.PATH || "") {
  const extensions =
    process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];

  for (const directory of environmentPath.split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function findSclang(environment = process.env) {
  const candidates = [
    environment.SCLANG_PATH,
    findOnPath("sclang", environment.PATH),
    "/Applications/SuperCollider.app/Contents/MacOS/sclang",
    "/opt/homebrew/bin/sclang",
    "/usr/local/bin/sclang",
    "/usr/bin/sclang",
    environment.ProgramFiles
      ? path.join(
          environment.ProgramFiles,
          "SuperCollider",
          "sclang.exe",
        )
      : null,
  ];

  return candidates.find(isExecutable) || null;
}

module.exports = {
  findOnPath,
  findSclang,
  isExecutable,
};
