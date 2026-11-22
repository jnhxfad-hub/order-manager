import {
  loadBrowserStorageJson,
  saveBrowserStorageJson,
} from "@/lib/browser-runtime"

export const lastBackupStorageKey = "order-manager:last-database-backup"

export type LastBackupInfo = {
  path: string
  createdAt: string
  reason: "manual" | "restore-safety"
}

function isLastBackupReason(value: unknown): value is LastBackupInfo["reason"] {
  return value === "manual" || value === "restore-safety"
}

function isLastBackupInfo(value: unknown): value is LastBackupInfo {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.path === "string" &&
    candidate.path.length > 0 &&
    typeof candidate.createdAt === "string" &&
    candidate.createdAt.length > 0 &&
    isLastBackupReason(candidate.reason)
  )
}

export function readLastBackupInfo(): LastBackupInfo | null {
  const parsed = loadBrowserStorageJson<unknown>(lastBackupStorageKey, null)

  return isLastBackupInfo(parsed) ? parsed : null
}

export function saveLastBackupInfo(value: LastBackupInfo) {
  saveBrowserStorageJson(lastBackupStorageKey, value)
}
