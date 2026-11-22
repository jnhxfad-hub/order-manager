import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type TooltipProps = {
  align?: "center" | "end" | "start"
  children: ReactNode
  className?: string
  content: ReactNode
  contentClassName?: string
  side?: "bottom" | "top"
}

export function Tooltip({
  align = "center",
  children,
  className,
  content,
  contentClassName,
  side = "bottom",
}: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        className={cn(
          "pointer-events-none absolute z-50 hidden w-max max-w-56 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover/tooltip:block group-focus-within/tooltip:block",
          side === "top"
            ? "bottom-[calc(100%+6px)]"
            : "top-[calc(100%+6px)]",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "start" && "left-0",
          align === "end" && "right-0",
          contentClassName
        )}
      >
        {content}
      </span>
    </span>
  )
}
