import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
} from "./test-utils.mjs";

const tempDir = await createTempModuleDir("export-file-test-");
const browserRuntimePath = new URL("../../src/lib/browser-runtime.ts", import.meta.url);
const exportFilePath = new URL("../../src/lib/export-file.ts", import.meta.url);

await compileTsModule(browserRuntimePath, path.join(tempDir, "browser-runtime.mjs"));
await compileTsModule(
  exportFilePath,
  path.join(tempDir, "export-file.mjs"),
  (source) =>
    source
      .replace(
        'import { invoke } from "@tauri-apps/api/core"\n',
        "const invokeCalls = []\nconst invoke = async (command, args) => { invokeCalls.push({ command, args }) }\nexport { invokeCalls }\n",
      )
      .replace(
        'import { save } from "@tauri-apps/plugin-dialog"\n',
        "const saveCalls = []\nlet nextSavePath = undefined\nconst save = async (options) => { saveCalls.push(options); return nextSavePath }\nexport { saveCalls }\nexport function setNextSavePath(path) { nextSavePath = path }\n",
      )
      .replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"'),
);

const clickedLinks = [];
const appendedLinks = [];
const createdBlobs = [];
const revokedUrls = [];

globalThis.window = {};
globalThis.document = {
  body: {
    append(link) {
      appendedLinks.push(link);
    },
  },
  createElement(tagName) {
    assert.equal(tagName, "a");

    return {
      click() {
        clickedLinks.push(this);
      },
      remove() {
        this.removed = true;
      },
    };
  },
};
globalThis.URL = {
  createObjectURL(blob) {
    createdBlobs.push(blob);
    return `blob:test-${createdBlobs.length}`;
  },
  revokeObjectURL(url) {
    revokedUrls.push(url);
  },
};

const {
  invokeCalls,
  saveCalls,
  saveCsvFile,
  setNextSavePath,
} = await import(pathToFileURL(path.join(tempDir, "export-file.mjs")).href);

await saveCsvFile({
  contents: "商品,数量\r\n边框,2\r\n",
  defaultPath: "订单.csv",
});

assert.equal(createdBlobs.length, 1);
assert.equal(createdBlobs[0].type, "text/csv;charset=utf-8");
assert.equal(await createdBlobs[0].text(), "商品,数量\r\n边框,2\r\n");
assert.equal(appendedLinks.length, 1);
assert.equal(clickedLinks[0], appendedLinks[0]);
assert.equal(appendedLinks[0].href, "blob:test-1");
assert.equal(appendedLinks[0].download, "订单.csv");
assert.equal(appendedLinks[0].removed, true);
assert.deepEqual(revokedUrls, ["blob:test-1"]);

window.__TAURI_INTERNALS__ = {};
await saveCsvFile({
  contents: "商品,数量\r\n边框,3\r\n",
  defaultPath: "导出.csv",
});

assert.equal(saveCalls.length, 1);
assert.deepEqual(saveCalls[0], {
  defaultPath: "导出.csv",
  filters: [{ extensions: ["csv"], name: "CSV 文件" }],
});
assert.deepEqual(invokeCalls, []);

setNextSavePath("/tmp/orders.csv");
await saveCsvFile({
  contents: "商品,数量\r\n边框,4\r\n",
  defaultPath: "导出.csv",
});

assert.equal(saveCalls.length, 2);
assert.deepEqual(invokeCalls, [
  {
    args: {
      contents: "商品,数量\r\n边框,4\r\n",
      path: "/tmp/orders.csv",
    },
    command: "write_text_file",
  },
]);

console.log("export file rules ok");
