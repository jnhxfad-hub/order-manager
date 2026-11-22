import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type EmptyStateProps = {
  action?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  title: ReactNode
}

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center px-4 py-10 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && (
        <div className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </div>
      )}
      {action && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  )
}
