import { LoaderCircle, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DataStateProps = {
  action?: ReactNode
  className?: string
  description?: ReactNode
  title: ReactNode
}

export function LoadingState({ className, title }: DataStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground",
        className
      )}
    >
      <LoaderCircle className="mb-3 size-5 animate-spin" />
      {title}
    </div>
  )
}

export function ErrorState({
  action,
  className,
  description,
  title,
}: DataStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center px-4 py-10 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
        <TriangleAlert className="size-4" />
      </div>
      <div className="text-sm font-medium text-destructive">{title}</div>
      {description && (
        <div className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function RetryButton({
  disabled,
  onClick,
}: {
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button disabled={disabled} onClick={onClick} size="sm" variant="outline">
      重试
    </Button>
  )
}
