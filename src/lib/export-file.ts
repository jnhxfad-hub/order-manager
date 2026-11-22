import { invoke } from "@tauri-apps/api/core"
import { save } from "@tauri-apps/plugin-dialog"

import { isTauriRuntime } from "@/lib/browser-runtime"

export async function saveCsvFile({
  contents,
  defaultPath,
}: {
  contents: string
  defaultPath: string
}) {
  if (!isTauriRuntime()) {
    downloadCsvInBrowser(contents, defaultPath)
    return
  }

  const path = await save({
    defaultPath,
    filters: [{ extensions: ["csv"], name: "CSV 文件" }],
  })

  if (!path) {
    return
  }

  await invoke("write_text_file", { contents, path })
}

function downloadCsvInBrowser(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
