export function getFileNameFromPath(path: string) {
  try {
    const url = new URL(path)
    if (url.protocol === "file:") {
      return decodeURIComponent(url.pathname.split(/[\\/]/).pop() ?? path)
    }
  } catch {
    // Plain local paths are expected on desktop.
  }

  return path.split(/[\\/]/).pop() ?? path
}
