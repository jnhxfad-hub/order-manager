export type AppErrorPayload = {
  code?: unknown
  message?: unknown
}

function asAppErrorPayload(error: unknown): AppErrorPayload | undefined {
  return typeof error === "object" && error !== null
    ? (error as AppErrorPayload)
    : undefined
}

export function getErrorMessage(error: unknown, fallback = "操作失败") {
  if (!error) {
    return undefined
  }

  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  const message = asAppErrorPayload(error)?.message
  return typeof message === "string" && message.trim() ? message : fallback
}

export function getErrorCode(error: unknown) {
  const code = asAppErrorPayload(error)?.code
  return typeof code === "string" && code.trim() ? code : undefined
}
