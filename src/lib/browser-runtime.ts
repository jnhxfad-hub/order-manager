export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export function loadBrowserStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback
  }

  const rawValue = window.localStorage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

export function saveBrowserStorageJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function loadBrowserStorageArray<T>(key: string) {
  return loadBrowserStorageJson<T[]>(key, [])
}

export function loadBrowserStorageRecordMap<T>(key: string) {
  return new Map(
    Object.entries(loadBrowserStorageJson<Record<string, T>>(key, {}))
  )
}

export function saveBrowserStorageRecordMap<T>(
  key: string,
  map: Map<string, T>
) {
  saveBrowserStorageJson(key, Object.fromEntries(map.entries()))
}
