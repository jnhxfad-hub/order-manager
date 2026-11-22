import { Search, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SearchFieldProps = {
  className?: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}

export function SearchField({
  className = "w-80 max-w-full",
  onChange,
  placeholder,
  value,
}: SearchFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 pr-8 pl-8"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {value && (
        <Button
          aria-label="清空搜索"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={() => onChange("")}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
