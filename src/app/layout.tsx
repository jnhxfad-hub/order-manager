import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { getCurrentWindow } from "@tauri-apps/api/window"
import type { MouseEvent } from "react"
import {
  Blocks,
  Boxes,
  ClipboardList,
  PackageSearch,
  Settings,
  UsersRound,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const navigationItems = [
  { label: "订单", to: "/", icon: ClipboardList },
  { label: "客户", to: "/customers", icon: UsersRound },
  { label: "商品", to: "/products", icon: PackageSearch },
  { label: "库存", to: "/inventory", icon: Boxes },
  { label: "设置", to: "/settings", icon: Settings },
] as const

const routeTitles = [
  {
    match: (pathname: string) => pathname === "/",
    subtitle: "浏览、筛选、导出与进入订单",
    title: "订单工作台",
  },
  {
    match: (pathname: string) => pathname === "/orders/new",
    subtitle: "录入客户、明细、计价并保存或下单",
    title: "新建订单",
  },
  {
    match: (pathname: string) => pathname.startsWith("/orders/"),
    subtitle: "查看订单快照、明细、打印与导出",
    title: "订单详情",
  },
  {
    match: (pathname: string) => pathname === "/customers",
    subtitle: "维护客户资料、联系方式和加工费",
    title: "客户管理",
  },
  {
    match: (pathname: string) => pathname === "/products",
    subtitle: "维护商品资料并分配客户归属",
    title: "商品管理",
  },
  {
    match: (pathname: string) => pathname === "/inventory",
    subtitle: "处理订单库存、公共库存和库存流水",
    title: "库存管理",
  },
  {
    match: (pathname: string) => pathname === "/settings",
    subtitle: "管理本地数据文件与备份恢复",
    title: "系统设置",
  },
] as const

async function startWindowDrag(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0 || !("__TAURI_INTERNALS__" in window)) {
    return
  }

  event.preventDefault()
  await getCurrentWindow().startDragging()
}

export function AppLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const routeTitle =
    routeTitles.find((item) => item.match(pathname)) ?? routeTitles[0]

  return (
    <main className="flex h-dvh overflow-hidden bg-background pt-9 text-foreground">
      <div
        className="fixed inset-x-0 top-0 z-50 h-9 border-b bg-sidebar/95 shadow-[0_1px_0_oklch(1_0_0/70%)_inset]"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      />

      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="px-4 py-4">
          <Link
            aria-label="ALU Order PRO"
            className="inline-flex max-w-full items-center gap-2.5 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            to="/"
          >
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-accent text-primary shadow-sm">
              <Blocks className="size-4.5" strokeWidth={2.4} />
              <span className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-primary/25" />
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5 leading-none">
                <span className="text-2xl font-black text-foreground">
                  ALU{" "}
                </span>
                <span className="text-2xl font-light text-muted-foreground">
                  Order
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-semibold leading-none text-accent-foreground">
                PRO
              </span>
            </span>
          </Link>
        </div>

        <Separator />

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigationItems.map((item) => (
            <Link
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
              }}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              key={item.to}
              to={item.to}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          本地数据工作台
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/80 px-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">{routeTitle.title}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {routeTitle.subtitle}
            </p>
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-5">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
