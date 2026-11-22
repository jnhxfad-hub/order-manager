import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function createTempModuleDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function compileTsModule(
  sourcePath,
  outputPath,
  transform = (source) => source,
) {
  const sourceText = transform(await fs.readFile(sourcePath, "utf8"));
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  await fs.writeFile(outputPath, compiled, "utf8");
}

export async function importCompiledTsModule(
  sourcePath,
  outputPath,
  transform,
) {
  await compileTsModule(sourcePath, outputPath, transform);
  return import(pathToFileURL(outputPath).href);
}

export function createMemoryLocalStorage() {
  const values = new Map();

  return {
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

export function installBrowserTestWindow({
  captureEvents = false,
  includeAddEventListener = false,
} = {}) {
  const dispatchedEvents = [];
  const listeners = new Map();

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.detail = init.detail;
      this.type = type;
    }
  };
  globalThis.window = {
    localStorage: createMemoryLocalStorage(),
  };

  if (includeAddEventListener) {
    window.addEventListener = (type, listener) => {
      const eventListeners = listeners.get(type) ?? [];

      eventListeners.push(listener);
      listeners.set(type, eventListeners);
    };
    window.removeEventListener = (type, listener) => {
      const eventListeners = listeners.get(type) ?? [];

      listeners.set(
        type,
        eventListeners.filter((eventListener) => eventListener !== listener),
      );
    };
  }

  if (captureEvents || includeAddEventListener) {
    window.dispatchEvent = (event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }

      if (!captureEvents) {
        return true;
      }

      dispatchedEvents.push(event);
      return true;
    };
  }

  return {
    dispatchedEvents,
    listeners,
    localStorage: window.localStorage,
    window,
  };
}
