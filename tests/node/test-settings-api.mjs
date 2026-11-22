import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createMemoryLocalStorage,
  createTempModuleDir,
} from "./test-utils.mjs";

globalThis.window = {
  localStorage: createMemoryLocalStorage(),
};
globalThis.__settingsDialogCalls = [];
globalThis.__settingsSaveResult = null;
globalThis.__settingsOpenResult = null;
globalThis.__settingsVersion = "1.0.0-test";

const tempDir = await createTempModuleDir("settings-api-test-");
const browserRuntimePath = new URL("../../src/lib/browser-runtime.ts", import.meta.url);
const datetimePath = new URL("../../src/lib/datetime.ts", import.meta.url);
const settingsApiPath = new URL(
  "../../src/features/settings/api/settings-api.ts",
  import.meta.url,
);
const settingsStoragePath = new URL(
  "../../src/features/settings/api/settings-storage.ts",
  import.meta.url,
);

await compileTsModule(browserRuntimePath, path.join(tempDir, "browser-runtime.mjs"));
await compileTsModule(datetimePath, path.join(tempDir, "datetime.mjs"));
await compileTsModule(
  settingsStoragePath,
  path.join(tempDir, "settings-storage.mjs"),
  (source) => source.replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"'),
);
await compileTsModule(
  settingsApiPath,
  path.join(tempDir, "settings-api.mjs"),
  (source) =>
    source
      .replace(
        'import { invoke } from "@tauri-apps/api/core"\n',
        "const invoke = async (command, args) => ({ args, command })\n",
      )
      .replace(
        'import { getVersion } from "@tauri-apps/api/app"\n',
        "const getVersion = async () => globalThis.__settingsVersion\n",
      )
      .replace(
        'import { open, save } from "@tauri-apps/plugin-dialog"\n',
        [
          "const open = async (options) => {",
          "  globalThis.__settingsDialogCalls.push({ options, type: 'open' })",
          "  return globalThis.__settingsOpenResult",
          "}",
          "const save = async (options) => {",
          "  globalThis.__settingsDialogCalls.push({ options, type: 'save' })",
          "  return globalThis.__settingsSaveResult",
          "}",
        ].join("\n") + "\n",
      )
      .replace('from "@/lib/datetime"', 'from "./datetime.mjs"')
      .replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"'),
);

const {
  backupDatabase,
  getAppVersionInfo,
  getDatabasePath,
  restoreDatabase,
  selectRestoreDatabaseFile,
} = await import(pathToFileURL(path.join(tempDir, "settings-api.mjs")).href);
const {
  lastBackupStorageKey,
  readLastBackupInfo,
  saveLastBackupInfo,
} = await import(pathToFileURL(path.join(tempDir, "settings-storage.mjs")).href);

assert.equal(readLastBackupInfo(), null);
saveLastBackupInfo({
  createdAt: "2026-07-06T08:00:00.000Z",
  path: "/tmp/manual-backup.sqlite",
  reason: "manual",
});
assert.deepEqual(readLastBackupInfo(), {
  createdAt: "2026-07-06T08:00:00.000Z",
  path: "/tmp/manual-backup.sqlite",
  reason: "manual",
});
window.localStorage.setItem(
  lastBackupStorageKey,
  JSON.stringify({
    createdAt: "2026-07-06T08:05:00.000Z",
    path: "/tmp/backup.sqlite",
    reason: "typo",
  }),
);
assert.equal(readLastBackupInfo(), null);
window.localStorage.setItem(lastBackupStorageKey, "{");
assert.equal(readLastBackupInfo(), null);

assert.deepEqual(await getAppVersionInfo(), {
  buildTime: "unknown",
  runtime: "browser",
  version: "浏览器预览",
});
assert.equal(await getDatabasePath(), "浏览器预览模式未连接本地数据库");
await assert.rejects(
  () => backupDatabase(),
  /浏览器预览模式不支持备份本地数据库/,
);
await assert.rejects(
  () => selectRestoreDatabaseFile(),
  /浏览器预览模式不支持恢复本地数据库/,
);
await assert.rejects(
  () => restoreDatabase("/tmp/order-manager.sqlite"),
  /浏览器预览模式不支持恢复本地数据库/,
);

window.__TAURI_INTERNALS__ = {};

assert.deepEqual(await getAppVersionInfo(), {
  buildTime: "unknown",
  runtime: "tauri",
  version: "1.0.0-test",
});
assert.deepEqual(await getDatabasePath(), {
  args: undefined,
  command: "get_database_path",
});

globalThis.__settingsSaveResult = null;
assert.equal(await backupDatabase(), null);
assert.equal(globalThis.__settingsDialogCalls.at(-1).type, "save");
assert.match(
  globalThis.__settingsDialogCalls.at(-1).options.defaultPath,
  /^order-manager-backup-\d{8}-\d{4}\.sqlite$/,
);
assert.deepEqual(globalThis.__settingsDialogCalls.at(-1).options.filters, [
  { extensions: ["sqlite"], name: "SQLite 数据库" },
]);

globalThis.__settingsSaveResult = "/tmp/order-manager-backup.sqlite";
assert.deepEqual(await backupDatabase(), {
  args: { path: "/tmp/order-manager-backup.sqlite" },
  command: "backup_database",
});

globalThis.__settingsOpenResult = ["/tmp/not-string.sqlite"];
assert.equal(await selectRestoreDatabaseFile(), null);
assert.equal(globalThis.__settingsDialogCalls.at(-1).type, "open");
assert.deepEqual(globalThis.__settingsDialogCalls.at(-1).options, {
  filters: [{ extensions: ["sqlite", "db"], name: "SQLite 数据库" }],
  multiple: false,
});

globalThis.__settingsOpenResult = "/tmp/restore.sqlite";
assert.equal(await selectRestoreDatabaseFile(), "/tmp/restore.sqlite");
assert.deepEqual(await restoreDatabase("/tmp/restore.sqlite"), {
  args: { path: "/tmp/restore.sqlite" },
  command: "restore_database",
});

console.log("settings api rules ok");
