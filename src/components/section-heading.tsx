import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function SectionHeading({
  badge,
  className,
  description,
  icon,
  title,
}: {
  badge?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  title: ReactNode
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-h-8 items-center gap-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-primary" />
        {icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
        <h2 className="truncate text-base font-semibold">{title}</h2>
        {badge ? (
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
