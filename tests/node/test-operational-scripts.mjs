import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const scripts = [
  {
    helpText: "pnpm run backup:real-db",
    path: "scripts/backup-real-db.mjs",
    shortHelp: true,
  },
  {
    helpPatterns: [/-b, --backup <path>/],
    helpText: "pnpm run restore:real-db",
    path: "scripts/restore-real-db.mjs",
    shortHelp: true,
  },
  {
    helpPatterns: [/--run-id <id>/, /--manifest <path>/],
    helpText: "桌面 App 验收",
    path: "scripts/desktop-acceptance.mjs",
    shortHelp: true,
  },
];

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
  );

  return result.stdout;
}

for (const script of scripts) {
  run("node", ["--check", script.path]);

  const helpOutput = run("node", [script.path, "--help"]);

  assert.match(helpOutput, /Usage:/);
  assert.match(helpOutput, new RegExp(script.helpText));
  assert.match(helpOutput, /-h, --help/);
  for (const pattern of script.helpPatterns ?? []) {
    assert.match(helpOutput, pattern);
  }

  if (script.shortHelp) {
    const shortHelpOutput = run("node", [script.path, "-h"]);

    assert.match(shortHelpOutput, /Usage:/);
    assert.match(shortHelpOutput, new RegExp(script.helpText));
    assert.match(shortHelpOutput, /-h, --help/);
    for (const pattern of script.helpPatterns ?? []) {
      assert.match(shortHelpOutput, pattern);
    }
  }
}

const tauriConfig = JSON.parse(
  readFileSync("src-tauri/tauri.conf.json", "utf8"),
);
const productionCsp = tauriConfig.app?.security?.csp;
const developmentCsp = tauriConfig.app?.security?.devCsp;

assert.equal(typeof productionCsp, "string");
assert.match(productionCsp, /default-src 'self'/);
assert.match(productionCsp, /script-src 'self'/);
assert.match(productionCsp, /connect-src[^;]*ipc:/);
assert.match(productionCsp, /http:\/\/ipc\.localhost/);
assert.match(productionCsp, /img-src[^;]*blob:/);
assert.doesNotMatch(productionCsp, /unsafe-eval/);

assert.equal(typeof developmentCsp, "string");
assert.match(developmentCsp, /http:\/\/localhost:1420/);
assert.match(developmentCsp, /ws:\/\/localhost:1421/);
assert.match(developmentCsp, /unsafe-eval/);

console.log("operational script checks ok");
