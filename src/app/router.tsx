import {
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"

import { AppLayout } from "@/app/layout"

const rootRoute = createRootRoute({
  component: AppLayout,
})

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(
    () => import("@/features/orders/pages/orders-page"),
    "OrdersPage"
  ),
})

const newOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/new",
  component: lazyRouteComponent(
    () => import("@/features/orders/pages/order-form-page"),
    "OrderFormPage"
  ),
})

const editOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId",
  component: lazyRouteComponent(
    () => import("@/features/orders/pages/order-form-page"),
    "OrderFormPage"
  ),
})

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customers",
  component: lazyRouteComponent(
    () => import("@/features/customers/pages/customers-page"),
    "CustomersPage"
  ),
})

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products",
  component: lazyRouteComponent(
    () => import("@/features/products/pages/products-page"),
    "ProductsPage"
  ),
})

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/inventory",
  component: lazyRouteComponent(
    () => import("@/features/inventory/pages/inventory-page"),
    "InventoryPage"
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(
    () => import("@/features/settings/pages/settings-page"),
    "SettingsPage"
  ),
})

const routeTree = rootRoute.addChildren([
  ordersRoute,
  newOrderRoute,
  editOrderRoute,
  customersRoute,
  productsRoute,
  inventoryRoute,
  settingsRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
