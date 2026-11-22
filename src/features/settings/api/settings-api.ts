import { invoke } from "@tauri-apps/api/core"
import { getVersion } from "@tauri-apps/api/app"
import { open, save } from "@tauri-apps/plugin-dialog"

import { isTauriRuntime } from "@/lib/browser-runtime"
import { formatTimestamp } from "@/lib/datetime"

export type RestoreDatabaseResult = {
  restoredPath: string
  safetyBackupPath: string
}

export type AppVersionInfo = {
  buildTime: string
  runtime: "browser" | "tauri"
  version: string
}

export async function getAppVersionInfo(): Promise<AppVersionInfo> {
  const buildTime =
    typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : "unknown"

  if (!isTauriRuntime()) {
    return {
      buildTime,
      runtime: "browser",
      version: "浏览器预览",
    }
  }

  return {
    buildTime,
    runtime: "tauri",
    version: await getVersion(),
  }
}

export async function getDatabasePath() {
  if (!isTauriRuntime()) {
    return "浏览器预览模式未连接本地数据库"
  }

  return invoke<string>("get_database_path")
}

export async function backupDatabase() {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不支持备份本地数据库")
  }

  const path = await save({
    defaultPath: `order-manager-backup-${formatTimestamp(new Date())}.sqlite`,
    filters: [{ extensions: ["sqlite"], name: "SQLite 数据库" }],
  })

  if (!path) {
    return null
  }

  return invoke<string>("backup_database", { path })
}

export async function selectRestoreDatabaseFile() {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不支持恢复本地数据库")
  }

  const path = await open({
    filters: [{ extensions: ["sqlite", "db"], name: "SQLite 数据库" }],
    multiple: false,
  })

  return typeof path === "string" ? path : null
}

export async function restoreDatabase(path: string) {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不支持恢复本地数据库")
  }

  return invoke<RestoreDatabaseResult>("restore_database", { path })
}
