import { useBlocker, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Menu } from "@base-ui/react/menu";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  ArrowDownWideNarrow,
  CircleCheck,
  ChevronDown,
  ClipboardCheck,
  Download,
  PlusIcon,
  Printer,
  Save,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { ErrorState, LoadingState, RetryButton } from "@/components/data-state";
import { MissingPriceTag } from "@/components/missing-price-tag";
import { SectionHeading } from "@/components/section-heading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createOrder,
  getOrder,
  parseOrderItemImportFile,
  updateOrder,
  type ParsedOrderItemImportRow,
  type UpsertOrderPayload,
} from "@/features/orders/api/orders-api";
import {
  areOrderDraftSnapshotsEqual,
  buildOrderItemImportPreviewRows,
  buildOrderPayload,
  calculateItemWeight,
  createDefaultOrderValues,
  createImportableOrderItemCsvRows,
  createOrderDraftSnapshot,
  createOrderItemImportTemplateCsvRows,
  editableItemFieldOrder,
  emptyItem,
  emptyProcessingFeeSnapshotX100,
  formatOrderDateTime,
  getMissingProcessingFeeMessage,
  getOrderFormStatus,
  getOrderItemTotals,
  getProcessingFeeX100ByCategory,
  groupOrderItemsByColor,
  isAluminumIngotPriceValid,
  isBlankItem,
  isItemFieldValid,
  orderDetailToFormValues,
  requiredItemFields,
  type EditableItemField,
  type OrderDraftSnapshot,
  type OrderFormFocusTarget,
  type OrderFormValues,
  type OrderItemFormValues,
  type RequiredItemField,
} from "@/features/orders/lib/order-form-utils";
import { listInventory } from "@/features/inventory/api/inventory-api";
import { PrintOrderView } from "@/features/orders/components/print-order-view";
import type { OrderStatus } from "@/features/orders/types";
import { getErrorMessage } from "@/lib/errors";
import { listCustomers } from "@/features/customers/api/customers-api";
import {
  getCustomerProcessingFeesX100,
  getMatchedSpecialPricingKeyword,
  hasAnyCustomerProcessingFee,
} from "@/features/customers/lib/customer-pricing";
import type { Customer } from "@/features/customers/types";
import { listProducts } from "@/features/products/api/products-api";
import type { Product } from "@/features/products/types";
import { isTauriRuntime } from "@/lib/browser-runtime";
import { createCsv } from "@/lib/csv";
import { saveCsvFile } from "@/lib/export-file";
import { getFileNameFromPath } from "@/lib/file-path";
import {
  formatTheoreticalWeightKg,
  formatThicknessMm,
  formatWeightPerMeterKg,
} from "@/lib/measurement";
import { parseIntegerInput } from "@/lib/number-input";
import {
  getProcessingCategoryFromColor,
  getProcessingCategoryQuantityItems,
} from "@/lib/processing-fees";
import { cn } from "@/lib/utils";

type SubmitIntent = "saved" | "ordered";
type TouchedItemFields = Record<
  string,
  Partial<Record<RequiredItemField, boolean>>
>;

export function OrderFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orderId } = useParams({ strict: false }) as { orderId?: string };
  const isEditing = Boolean(orderId);
  const bypassUnsavedPromptRef = useRef(false);
  const [values, setValues] = useState<OrderFormValues>(() =>
    createDefaultOrderValues(),
  );
  const [lastSavedDraftSnapshot, setLastSavedDraftSnapshot] =
    useState<OrderDraftSnapshot | null>(() =>
      createOrderDraftSnapshot(createDefaultOrderValues()),
    );
  const [savedStatus, setSavedStatus] = useState<OrderStatus | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [colorGroupingNotice, setColorGroupingNotice] = useState<{
    message: string;
  } | null>(null);
  useEffect(() => {
    if (!colorGroupingNotice) return;
    const timer = window.setTimeout(() => setColorGroupingNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [colorGroupingNotice]);
  const [customerTouched, setCustomerTouched] = useState(false);
  const [handlerTouched, setHandlerTouched] = useState(false);
  const [aluminumIngotTouched, setAluminumIngotTouched] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [touchedItemFields, setTouchedItemFields] = useState<TouchedItemFields>(
    {},
  );
  const [itemImportOpen, setItemImportOpen] = useState(false);
  const [itemImportRows, setItemImportRows] = useState<
    ParsedOrderItemImportRow[]
  >([]);
  const [itemImportErrors, setItemImportErrors] = useState<string[]>([]);
  const [itemImportFileName, setItemImportFileName] = useState("");

  const orderQuery = useQuery({
    enabled: isEditing,
    queryKey: ["orders", orderId],
    queryFn: () => getOrder(orderId ?? ""),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "order-picker"],
    queryFn: () =>
      listCustomers({
        page: 1,
        pageSize: 1000,
      }),
  });
  const productsQuery = useQuery({
    enabled: Boolean(values.customerId),
    queryKey: ["products", "order-picker", values.customerId],
    queryFn: () =>
      listProducts({
        customerId: values.customerId,
        page: 1,
        pageSize: 10000,
      }),
  });
  const customers = customersQuery.data?.customers ?? [];
  const products = productsQuery.data?.products ?? [];
  const isCustomerListEmpty =
    !customersQuery.isLoading &&
    !customersQuery.isError &&
    customers.length === 0;
  const isSelectedCustomerProductListEmpty =
    Boolean(values.customerId) &&
    !productsQuery.isLoading &&
    !productsQuery.isError &&
    products.length === 0;
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const itemImportPreviewRows = useMemo(
    () =>
      buildOrderItemImportPreviewRows(itemImportRows, products, values.items),
    [itemImportRows, products, values.items],
  );
  const itemImportValidationErrors = itemImportPreviewRows.flatMap((row) =>
    row.errors.map((error) => `第 ${row.rowNumber} 行：${error}`),
  );
  const canConfirmItemImport =
    itemImportRows.length > 0 &&
    itemImportErrors.length === 0 &&
    itemImportValidationErrors.length === 0;
  const currentCustomer = customerById.get(values.customerId) ?? null;
  const matchedSpecialPricingKeyword = getMatchedSpecialPricingKeyword(
    currentCustomer,
    values.note,
  );
  const shouldBlockProductSelect =
    !values.customerId || isSelectedCustomerProductListEmpty;
  const productSelectPlaceholder = !values.customerId
    ? "请先选择客户"
    : isSelectedCustomerProductListEmpty
      ? "请先添加客户商品"
      : "选择商品";
  const currentDraftSnapshot = useMemo(
    () => createOrderDraftSnapshot(values),
    [values],
  );
  const hasUnsavedChanges =
    savedStatus !== "ordered" &&
    lastSavedDraftSnapshot !== null &&
    !areOrderDraftSnapshotsEqual(currentDraftSnapshot, lastSavedDraftSnapshot);

  const navigationBlocker = useBlocker({
    disabled: !hasUnsavedChanges,
    enableBeforeUnload: () => hasUnsavedChanges,
    withResolver: true,
    shouldBlockFn: () => {
      if (bypassUnsavedPromptRef.current) {
        bypassUnsavedPromptRef.current = false;
        return false;
      }

      return true;
    },
  });

  useEffect(() => {
    if (!orderQuery.data) {
      return;
    }

    const nextValues = orderDetailToFormValues(orderQuery.data);

    setValues(nextValues);
    setLastSavedDraftSnapshot(createOrderDraftSnapshot(nextValues));
    setSavedStatus(orderQuery.data.status);
    resetTouchedFields();
  }, [orderQuery.data]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    const nextValues = createDefaultOrderValues();

    setValues(nextValues);
    setLastSavedDraftSnapshot(createOrderDraftSnapshot(nextValues));
    setSavedStatus(null);
    resetTouchedFields();
  }, [isEditing, orderId]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertOrderPayload) =>
      isEditing ? updateOrder(payload) : createOrder(payload),
    onSuccess: async (order, payload) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });

      if (payload.status === "ordered") {
        await queryClient.invalidateQueries({ queryKey: ["inventory"] });
        await queryClient.prefetchQuery({
          queryKey: ["inventory", ""],
          queryFn: () => listInventory({ search: "" }),
        });
      }

      const nextValues = orderDetailToFormValues(order);

      setValues(nextValues);
      setLastSavedDraftSnapshot(createOrderDraftSnapshot(nextValues));
      setSavedStatus(order.status);
      resetTouchedFields();

      bypassUnsavedPromptRef.current = true;
      navigate({ to: payload.status === "ordered" ? "/inventory" : "/" });
    },
  });
  const formStatus = getOrderFormStatus({
    hasUnsavedChanges,
    isSaving: saveMutation.isPending,
    savedStatus,
  });
  const isReadOnly = savedStatus === "ordered";
  const colorGrouping = useMemo(() => {
    const items = groupOrderItemsByColor(values.items);
    return {
      items,
      needed: items.some((item, index) => item !== values.items[index]),
    };
  }, [values.items]);
  const colorGroupingTooltip = isReadOnly
    ? "已下单订单不可整理"
    : values.items.length < 2
      ? "至少需要两条明细"
      : colorGrouping.needed
        ? "将相同颜色的明细排在一起"
        : "相同颜色已排在一起";


  const totalTheoreticalWeightKgX100 = values.items.reduce(
    (total, item) => total + calculateItemWeight(item),
    0,
  );
  const totalQuantity = values.items.reduce((total, item) => {
    const quantity = parseIntegerInput(item.quantity);

    return total + (quantity !== null && quantity > 0 ? quantity : 0);
  }, 0);
  const categoryQuantityItems = useMemo(() => {
    return getProcessingCategoryQuantityItems(
      values.items.flatMap((item) => {
        const quantity = parseIntegerInput(item.quantity);

        if (quantity === null) {
          return [];
        }

        return [{ color: item.color, quantity }];
      }),
    );
  }, [values.items]);
  const currentOrder = orderQuery.data;
  const canUseSavedOrder =
    Boolean(currentOrder) &&
    !hasUnsavedChanges &&
    (savedStatus === "saved" || savedStatus === "ordered");
  const currentOrderTotals = useMemo(
    () => getOrderItemTotals(currentOrder?.items ?? []),
    [currentOrder],
  );

  function updateValue<Key extends keyof OrderFormValues>(
    key: Key,
    value: OrderFormValues[Key],
  ) {
    if (isReadOnly) {
      return;
    }

    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    saveMutation.reset();
  }

  function organizeItemsByColor() {
    if (isReadOnly || !colorGrouping.needed) return;

    updateValue("items", colorGrouping.items);
    setColorGroupingNotice({
      message: "已将相同颜色的明细排在一起，请保存订单。",
    });
  }

  function selectCustomer(customer: Customer | undefined) {
    if (isReadOnly || !customer) {
      return;
    }

    const note = values.note;
    setValues((current) => ({
      ...current,
      customerAddress: customer.customerAddress,
      customerId: customer.id,
      customerName: customer.customerName,
      pricingTaxIncluded: customer.defaultPricingTaxIncluded,
      ...getCustomerProcessingFeesX100(
        customer,
        customer.defaultPricingTaxIncluded,
        note,
      ),
      items:
        current.customerId && current.customerId !== customer.id
          ? [emptyItem()]
          : current.items,
    }));
    setCustomerTouched(false);
    setFormError(null);
    saveMutation.reset();
  }

  function clearCustomer() {
    if (isReadOnly) {
      return;
    }

    setValues((current) => ({
      ...current,
      ...emptyProcessingFeeSnapshotX100(),
      customerAddress: "",
      customerId: "",
      customerName: "",
      items: [emptyItem()],
    }));
    setCustomerTouched(true);
    setFormError(null);
    saveMutation.reset();
  }

  function updatePricingTaxIncluded(pricingTaxIncluded: boolean) {
    if (isReadOnly) {
      return;
    }

    const customer = customerById.get(values.customerId);

    if (
      customer &&
      !hasAnyCustomerProcessingFee(customer, pricingTaxIncluded, values.note)
    ) {
      const hasSpecialPricing = Boolean(
        getMatchedSpecialPricingKeyword(customer, values.note),
      );
      setFormError(
        getMissingProcessingFeeMessage({
          hasSpecialPricing,
          pricingTaxIncluded,
        }),
      );
      return;
    }

    setValues((current) => ({
      ...current,
      pricingTaxIncluded,
      ...getCustomerProcessingFeesX100(
        customer,
        pricingTaxIncluded,
        current.note,
      ),
    }));
    setFormError(null);
    saveMutation.reset();
  }

  function updateOrderNote(note: string) {
    if (isReadOnly) {
      return;
    }

    const customer = customerById.get(values.customerId);

    setValues((current) => ({
      ...current,
      note,
      ...getCustomerProcessingFeesX100(customer, current.pricingTaxIncluded, note),
    }));
    setFormError(null);
    saveMutation.reset();
  }

  function updateItem(localId: string, updates: Partial<OrderItemFormValues>) {
    if (isReadOnly) {
      return;
    }

    setValues((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.localId === localId ? { ...item, ...updates } : item,
      ),
    }));
    setFormError(null);
    saveMutation.reset();
  }

  function resetTouchedFields() {
    setCustomerTouched(false);
    setHandlerTouched(false);
    setAluminumIngotTouched(false);
    setTouchedItemFields({});
  }

  function touchItemField(localId: string, field: RequiredItemField) {
    if (isReadOnly) {
      return;
    }

    setTouchedItemFields((current) => ({
      ...current,
      [localId]: {
        ...current[localId],
        [field]: true,
      },
    }));
  }

  function isItemFieldInvalid(
    item: OrderItemFormValues,
    field: RequiredItemField,
  ) {
    if (!touchedItemFields[item.localId]?.[field]) {
      return false;
    }

    return !isItemFieldValid(item, field);
  }

  function selectProduct(localId: string, product: Product | undefined) {
    if (isReadOnly || !product) {
      return;
    }

    updateItem(localId, {
      productId: product.id,
      productName: product.productName,
      productMoldCode: product.moldCode,
      thicknessMmX100: product.thicknessMmX100,
      weightPerMeterKgX1000: product.weightPerMeterKgX1000,
    });
    focusItemField(localId, "lengthMm");
  }

  function clearProduct(localId: string) {
    if (isReadOnly) {
      return;
    }

    updateItem(localId, {
      productId: "",
      productName: "",
      productMoldCode: "",
      thicknessMmX100: 0,
      weightPerMeterKgX1000: 0,
    });
  }

  function insertItem(localId: string, position: "above" | "below") {
    if (isReadOnly || !values.items.some((item) => item.localId === localId)) {
      return;
    }

    const nextItem = emptyItem();
    setValues((current) => {
      const index = current.items.findIndex((item) => item.localId === localId);
      if (index < 0) {
        return current;
      }
      const insertionIndex = index + (position === "below" ? 1 : 0);
      return {
        ...current,
        items: [
          ...current.items.slice(0, insertionIndex),
          nextItem,
          ...current.items.slice(insertionIndex),
        ],
      };
    });
    setFormError(null);
    saveMutation.reset();
    focusItemField(nextItem.localId, "product");
  }

  function removeItem(localId: string) {
    if (isReadOnly) {
      return;
    }

    setValues((current) => ({
      ...current,
      items:
        current.items.length > 1
          ? current.items.filter((item) => item.localId !== localId)
          : current.items,
    }));
    setTouchedItemFields((current) => {
      const next = { ...current };

      delete next[localId];
      return next;
    });
  }

  function resetItemImportDialog() {
    setItemImportOpen(false);
    setItemImportRows([]);
    setItemImportErrors([]);
    setItemImportFileName("");
  }

  async function selectItemImportFile() {
    if (isReadOnly) {
      return;
    }

    if (!values.customerId) {
      setFormError("请先选择客户，再导入明细。");
      return;
    }

    if (productsQuery.isLoading) {
      setFormError("正在读取客户商品，请稍后再试。");
      return;
    }

    if (productsQuery.isError) {
      setFormError(
        getErrorMessage(productsQuery.error, "读取客户商品失败") ??
          "读取客户商品失败",
      );
      return;
    }

    if (products.length === 0) {
      setFormError("当前客户没有归属商品，请先添加客户商品。");
      return;
    }

    const selected = await openFileDialog({
      filters: [
        {
          extensions: ["csv", "xlsx", "xls"],
          name: "订单明细导入文件",
        },
      ],
      multiple: false,
      title: "选择订单明细导入文件",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    try {
      const result = await parseOrderItemImportFile(selected);

      setItemImportFileName(getFileNameFromPath(selected));
      setItemImportRows(result.rows);
      setItemImportErrors(result.errors);
      setItemImportOpen(true);
      setFormError(null);
    } catch (error) {
      setFormError(
        getErrorMessage(error, "无法解析导入文件") ?? "无法解析导入文件",
      );
    }
  }

  function confirmItemImport() {
    if (!canConfirmItemImport) {
      return;
    }

    const importedItems = itemImportPreviewRows.flatMap((row) =>
      row.item ? [row.item] : [],
    );

    setValues((current) => {
      const existingItems = current.items.filter((item) => !isBlankItem(item));

      return {
        ...current,
        items: [...existingItems, ...importedItems],
      };
    });
    setFormError(null);
    saveMutation.reset();
    resetItemImportDialog();
  }

  async function downloadItemImportTemplate() {
    const csv = createCsv(createOrderItemImportTemplateCsvRows());

    await saveCsvFile({
      contents: csv,
      defaultPath: "订单明细导入模板.csv",
    });
  }

  function submit(intent: SubmitIntent) {
    if (isReadOnly) {
      return;
    }

    const payload = buildOrderPayload(values, intent, orderId, currentCustomer);

    if (typeof payload === "string") {
      markInvalidRequiredFields();
      setFormError(payload);
      focusOrderFormTarget(findFirstInvalidOrderField());
      return;
    }

    saveMutation.mutate(payload);
  }

  function markInvalidRequiredFields() {
    if (!values.customerId.trim()) {
      setCustomerTouched(true);
    }

    if (!values.handlerName.trim()) {
      setHandlerTouched(true);
    }

    if (!isAluminumIngotPriceValid(values.aluminumIngotPrice)) {
      setAluminumIngotTouched(true);
    }

    setTouchedItemFields((current) => {
      const next: TouchedItemFields = { ...current };

      for (const item of values.items) {
        const itemTouched = { ...next[item.localId] };

        for (const field of requiredItemFields) {
          if (!isItemFieldValid(item, field)) {
            itemTouched[field] = true;
          }
        }

        next[item.localId] = itemTouched;
      }

      return next;
    });
  }

  function focusItemField(localId: string, field: EditableItemField) {
    requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-order-row][data-order-field]",
        ),
      ).find(
        (element) =>
          element.dataset.orderRow === localId &&
          element.dataset.orderField === field,
      );

      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus();
    });
  }

  function findFirstInvalidOrderField(): OrderFormFocusTarget | null {
    if (!values.customerId.trim()) {
      return { kind: "field", field: "customerId" };
    }

    if (!values.handlerName.trim()) {
      return { kind: "field", field: "handlerName" };
    }

    if (!isAluminumIngotPriceValid(values.aluminumIngotPrice)) {
      return { kind: "field", field: "aluminumIngotPrice" };
    }

    for (const item of values.items) {
      if (!isItemFieldValid(item, "product")) {
        return { kind: "item", field: "product", localId: item.localId };
      }

      if (!isItemFieldValid(item, "lengthMm")) {
        return { kind: "item", field: "lengthMm", localId: item.localId };
      }

      if (!isItemFieldValid(item, "color")) {
        return { kind: "item", field: "color", localId: item.localId };
      }

      if (!isItemFieldValid(item, "quantity")) {
        return { kind: "item", field: "quantity", localId: item.localId };
      }

      const category = getProcessingCategoryFromColor(item.color.trim());

      if (getProcessingFeeX100ByCategory(values, category) <= 0) {
        return { kind: "item", field: "color", localId: item.localId };
      }
    }

    return null;
  }

  function focusOrderFormTarget(target: OrderFormFocusTarget | null) {
    if (!target) {
      return;
    }

    if (target.kind === "item") {
      focusItemField(target.localId, target.field);
      return;
    }

    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-order-field="${target.field}"]`,
      );

      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus();
    });
  }

  function confirmInputOnEnter(
    event: KeyboardEvent<HTMLInputElement>,
    localId: string,
    field: EditableItemField,
  ) {
    if (isReadOnly || event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    const nextField =
      editableItemFieldOrder[editableItemFieldOrder.indexOf(field) + 1];

    if (nextField) {
      focusItemField(localId, nextField);
      return;
    }

    const nextItem = emptyItem();

    updateValue("items", [...values.items, nextItem]);
    focusItemField(nextItem.localId, "product");
  }

  function openPrintPreview() {
    if (!canUseSavedOrder) {
      setFormError("请先保存订单，再预览打印。");
      return;
    }

    setIsPrintPreviewOpen(true);
  }

  async function printOrder() {
    if (!currentOrder) {
      return;
    }

    try {
      if (isTauriRuntime()) {
        await invoke("print_current_window", { orientation: "landscape" });
        return;
      }

      window.print();
    } catch (error) {
      setFormError(
        getErrorMessage(error, "无法打开打印面板") ?? "无法打开打印面板",
      );
    }
  }

  async function exportOrderItems() {
    if (!currentOrder || !canUseSavedOrder) {
      setFormError("请先保存订单，再导出。");
      return;
    }

    const csv = createCsv(createImportableOrderItemCsvRows(currentOrder.items));

    await saveCsvFile({
      contents: csv,
      defaultPath: `订单_${currentOrder.id}.csv`,
    });
  }

  const pageTitle = isReadOnly
    ? `查看订单 ${orderId}`
    : isEditing
      ? `编辑订单 ${orderId}`
      : "新建订单";
  const orderTimelineText = orderQuery.data
    ? `创建于 ${formatOrderDateTime(orderQuery.data.createdAt)} · 更新于 ${formatOrderDateTime(
        orderQuery.data.updatedAt,
      )}`
    : "选择商品后会自动带出模具、厚度、米重，并计算理论重量";
  const isOrderPrintReady = Boolean(currentOrder && isPrintPreviewOpen);

  if (orderQuery.isLoading) {
    return (
      <LoadingState
        className="rounded-lg border bg-card"
        title="正在读取订单"
      />
    );
  }

  if (orderQuery.isError) {
    return (
      <section className="rounded-lg border bg-card">
        <ErrorState
          action={
            <RetryButton
              disabled={orderQuery.isFetching}
              onClick={() => void orderQuery.refetch()}
            />
          }
          description={getErrorMessage(orderQuery.error)}
          title="读取订单失败"
        />
      </section>
    );
  }

  return (
    <div
      className={
        isOrderPrintReady ? "order-form-printing workspace-page order-editor" : "workspace-page order-editor"
      }
    >
      {colorGroupingNotice && createPortal(
        <div
          aria-atomic="true"
          className="fixed left-1/2 top-[max(1rem,calc(50%-170px))] z-50 flex w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 pr-12 text-emerald-900 shadow-xl dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100 print:hidden"
          role="status"
        >
          <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="grid gap-1">
            <strong className="text-sm">整理完成</strong>
            <p className="text-sm">{colorGroupingNotice.message}</p>
          </div>
          <Button
            aria-label="关闭整理提示"
            className="absolute right-2 top-2"
            onClick={() => setColorGroupingNotice(null)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>,
        document.body,
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold">{pageTitle}</h2>
            <Badge className={formStatus.className} variant="outline">
              {formStatus.label}
            </Badge>
            {matchedSpecialPricingKeyword && (
              <Badge
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
                variant="outline"
              >
                已匹配特殊计价：{matchedSpecialPricingKeyword}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {orderTimelineText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <>
              <Button
                disabled={saveMutation.isPending}
                onClick={() => submit("saved")}
                size="sm"
                variant="outline"
              >
                <Save className="size-4" />
                {saveMutation.isPending ? "保存中" : "保存"}
              </Button>
              <Button
                disabled={saveMutation.isPending}
                onClick={() => submit("ordered")}
                size="sm"
              >
                <ClipboardCheck className="size-4" />
                {saveMutation.isPending ? "下单中" : "下单"}
              </Button>
            </>
          )}
          <Button
            disabled={!canUseSavedOrder}
            onClick={openPrintPreview}
            size="sm"
            variant="outline"
          >
            <Printer className="size-4" />
            打印订单
          </Button>
          <Button
            aria-label="返回订单列表"
            className="h-7"
            onClick={() => navigate({ to: "/" })}
            size="sm"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            返回订单
          </Button>
        </div>
      </div>

      <section className="order-basics rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="grid gap-4 p-4 md:grid-cols-4">
          <Field
            label={
              <>
                客户名称<span className="text-destructive">*</span>
              </>
            }
          >
            <Select
              clearable
              disabled={isReadOnly || customersQuery.isLoading}
              onValueChange={(value) => {
                if (value) {
                  selectCustomer(customerById.get(value));
                } else {
                  clearCustomer();
                }
              }}
              value={values.customerId}
            >
              <SelectTrigger
                aria-invalid={customerTouched && !values.customerId}
                className={cn(
                  "w-full! min-w-0",
                  customerTouched && !values.customerId
                    ? "border-destructive"
                    : undefined,
                )}
                data-order-field="customerId"
              >
                <SelectValue
                  className={cn(
                    isCustomerListEmpty &&
                      !values.customerId &&
                      "text-destructive",
                  )}
                >
                  {() =>
                    currentCustomer?.customerName ||
                    values.customerName ||
                    (isCustomerListEmpty ? "请先添加客户" : "选择客户")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.customerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="客户地址">
            <Input
              disabled={isReadOnly}
              value={values.customerAddress}
              onChange={(event) =>
                updateValue("customerAddress", event.target.value)
              }
            />
          </Field>
          <Field
            label={
              <>
                经手人<span className="text-destructive">*</span>
              </>
            }
          >
            <Input
              aria-invalid={handlerTouched && !values.handlerName.trim()}
              data-order-field="handlerName"
              disabled={isReadOnly}
              onBlur={() => setHandlerTouched(true)}
              value={values.handlerName}
              onChange={(event) =>
                updateValue("handlerName", event.target.value)
              }
            />
          </Field>
          <Field label="下单日期">
            <Input
              disabled={isReadOnly}
              type="date"
              value={values.orderedDate}
              onChange={(event) =>
                updateValue("orderedDate", event.target.value)
              }
            />
          </Field>
          <Field
            label={
              <>
                铝锭价<span className="text-destructive">*</span>
              </>
            }
          >
            <Input
              aria-invalid={
                aluminumIngotTouched &&
                !isAluminumIngotPriceValid(values.aluminumIngotPrice)
              }
              data-order-field="aluminumIngotPrice"
              disabled={isReadOnly}
              inputMode="decimal"
              onBlur={() => setAluminumIngotTouched(true)}
              placeholder="0.00"
              value={values.aluminumIngotPrice}
              onChange={(event) =>
                updateValue("aluminumIngotPrice", event.target.value)
              }
            />
          </Field>
          <Field label="计价是否含税">
            <Select
              disabled={isReadOnly}
              onValueChange={(value) =>
                updatePricingTaxIncluded(value !== "excluded")
              }
              value={values.pricingTaxIncluded ? "included" : "excluded"}
            >
              <SelectTrigger className="w-full! min-w-0">
                <SelectValue>
                  {() => (values.pricingTaxIncluded ? "含税" : "不含税")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  className="data-disabled:opacity-100"
                  disabled={
                    Boolean(currentCustomer) &&
                    !hasAnyCustomerProcessingFee(
                      currentCustomer,
                      true,
                      values.note,
                    )
                  }
                  value="included"
                >
                  含税
                  {currentCustomer &&
                    !hasAnyCustomerProcessingFee(
                      currentCustomer,
                      true,
                      values.note,
                    ) && <MissingPriceTag />}
                </SelectItem>
                <SelectItem
                  className="data-disabled:opacity-100"
                  disabled={
                    Boolean(currentCustomer) &&
                    !hasAnyCustomerProcessingFee(
                      currentCustomer,
                      false,
                      values.note,
                    )
                  }
                  value="excluded"
                >
                  不含税
                  {currentCustomer &&
                    !hasAnyCustomerProcessingFee(
                      currentCustomer,
                      false,
                      values.note,
                    ) && <MissingPriceTag />}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-4">
            <Field label="备注">
              <Input
                data-order-field="orderNote"
                disabled={isReadOnly}
                value={values.note}
                onChange={(event) => updateOrderNote(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="workspace-card order-details overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <SectionHeading
            badge={`${values.items.length} 条`}
            description={`合计 ${formatTheoreticalWeightKg(
              totalTheoreticalWeightKgX100,
            )} kg`}
            title="订单明细"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              onClick={() => void downloadItemImportTemplate()}
              size="sm"
              variant="outline"
            >
              <Download className="size-4" />
              下载模板
            </Button>
            <Button
              disabled={isReadOnly}
              onClick={() => void selectItemImportFile()}
              size="sm"
              variant="outline"
            >
              <UploadIcon className="size-4" />
              导入明细
            </Button>
            <Button
              disabled={!canUseSavedOrder}
              onClick={() => void exportOrderItems()}
              size="sm"
              variant="outline"
            >
              <Download className="size-4" />
              导出明细
            </Button>
            <Tooltip align="end" content={colorGroupingTooltip} side="bottom">
              <Button
                disabled={isReadOnly || !colorGrouping.needed}
                onClick={organizeItemsByColor}
                size="sm"
                type="button"
                variant="outline"
              >
                <ArrowDownWideNarrow className="size-4" />
                按颜色整理
              </Button>
            </Tooltip>
            <Button
              disabled={isReadOnly}
              onClick={() =>
                updateValue("items", [...values.items, emptyItem()])
              }
              size="sm"
              variant="outline"
            >
              <PlusIcon className="size-4" />
              添加商品
            </Button>
          </div>
        </div>

        <Table className="min-w-260 table-fixed">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-52.5 px-3">商品</TableHead>
              <TableHead className="w-23 px-3">模具编号</TableHead>
              <TableHead className="w-19 px-3 text-right">厚度(mm)</TableHead>
              <TableHead className="w-22 px-3 text-right">米重(kg/m)</TableHead>
              <TableHead className="w-26 px-3">
                长度(mm)<span className="ml-0.5 text-destructive">*</span>
              </TableHead>
              <TableHead className="w-26 px-3">
                颜色<span className="ml-0.5 text-destructive">*</span>
              </TableHead>
              <TableHead className="w-22 px-3">
                数量(支)<span className="ml-0.5 text-destructive">*</span>
              </TableHead>
              <TableHead className="w-26 px-3 pr-6 text-right">
                理论重量
              </TableHead>
              <TableHead className="w-29.5 px-3">备注</TableHead>
              <TableHead className="w-28 px-3 text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {values.items.map((item) => (
              <TableRow key={item.localId}>
                <TableCell className="px-3 py-3">
                  <Select
                    clearable
                    disabled={isReadOnly || shouldBlockProductSelect}
                    onValueChange={(value) => {
                      if (value) {
                        selectProduct(item.localId, productById.get(value));
                      } else {
                        clearProduct(item.localId);
                      }
                    }}
                    value={item.productId}
                  >
                    <SelectTrigger
                      aria-invalid={isItemFieldInvalid(item, "product")}
                      className={cn(
                        "w-full",
                        isItemFieldInvalid(item, "product") &&
                          "border-destructive",
                      )}
                      data-order-field="product"
                      data-order-row={item.localId}
                      onKeyDown={(event) => {
                        if (
                          shouldBlockProductSelect &&
                          [" ", "Enter", "ArrowDown"].includes(event.key)
                        ) {
                          event.preventBaseUIHandler();
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      onMouseDown={(event) => {
                        if (shouldBlockProductSelect) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                    >
                      <SelectValue
                        className={cn(
                          shouldBlockProductSelect &&
                            !item.productName &&
                            "text-destructive",
                        )}
                      >
                        {() => item.productName || productSelectPlaceholder}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.productName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="px-3 py-3 text-muted-foreground">
                  {item.productMoldCode || "-"}
                </TableCell>
                <TableCell className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                  {item.thicknessMmX100
                    ? formatThicknessMm(item.thicknessMmX100)
                    : "-"}
                </TableCell>
                <TableCell className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                  {item.weightPerMeterKgX1000
                    ? formatWeightPerMeterKg(item.weightPerMeterKgX1000)
                    : "-"}
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Input
                    aria-invalid={isItemFieldInvalid(item, "lengthMm")}
                    className="w-full tabular-nums"
                    disabled={isReadOnly}
                    inputMode="numeric"
                    min={1}
                    onBlur={() => touchItemField(item.localId, "lengthMm")}
                    onKeyDown={(event) =>
                      confirmInputOnEnter(event, item.localId, "lengthMm")
                    }
                    data-order-field="lengthMm"
                    data-order-row={item.localId}
                    type="number"
                    value={item.lengthMm}
                    onChange={(event) =>
                      updateItem(item.localId, {
                        lengthMm: event.target.value,
                      })
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Input
                    aria-invalid={isItemFieldInvalid(item, "color")}
                    className="w-full"
                    disabled={isReadOnly}
                    onBlur={() => touchItemField(item.localId, "color")}
                    onKeyDown={(event) =>
                      confirmInputOnEnter(event, item.localId, "color")
                    }
                    data-order-field="color"
                    data-order-row={item.localId}
                    value={item.color}
                    onChange={(event) =>
                      updateItem(item.localId, { color: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Input
                    aria-invalid={isItemFieldInvalid(item, "quantity")}
                    className="w-full tabular-nums"
                    disabled={isReadOnly}
                    inputMode="numeric"
                    min={1}
                    onBlur={() => touchItemField(item.localId, "quantity")}
                    onKeyDown={(event) =>
                      confirmInputOnEnter(event, item.localId, "quantity")
                    }
                    data-order-field="quantity"
                    data-order-row={item.localId}
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.localId, {
                        quantity: event.target.value,
                      })
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-3 pr-6 text-right font-medium tabular-nums">
                  {formatTheoreticalWeightKg(calculateItemWeight(item))} kg
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Input
                    disabled={isReadOnly}
                    onKeyDown={(event) =>
                      confirmInputOnEnter(event, item.localId, "note")
                    }
                    data-order-field="note"
                    data-order-row={item.localId}
                    value={item.note}
                    onChange={(event) =>
                      updateItem(item.localId, { note: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-3 text-center">
                  <Menu.Root>
                    <Menu.Trigger
                      disabled={isReadOnly}
                      render={<Button size="xs" variant="ghost" />}
                      aria-label="插入明细"
                    >
                      插入
                      <ChevronDown className="size-3 text-muted-foreground transition-transform group-aria-expanded/button:rotate-180" />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Positioner sideOffset={4} align="end" className="z-50">
                        <Menu.Popup
                          finalFocus={false}
                          className="min-w-28 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none"
                        >
                          <Menu.Item
                            className="cursor-pointer rounded-sm px-3 py-2 outline-none data-highlighted:bg-muted"
                            onClick={() => insertItem(item.localId, "above")}
                          >
                            上方插入
                          </Menu.Item>
                          <Menu.Item
                            className="cursor-pointer rounded-sm px-3 py-2 outline-none data-highlighted:bg-muted"
                            onClick={() => insertItem(item.localId, "below")}
                          >
                            下方插入
                          </Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                  <Button
                    aria-label="删除明细"
                    disabled={isReadOnly || values.items.length <= 1}
                    onClick={() => removeItem(item.localId)}
                    size="icon-xs"
                    variant="ghost-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3 text-sm">
          <div className="text-muted-foreground">
            带 <span className="font-medium text-destructive">*</span> 为必填
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div className="text-muted-foreground">
              商品数量
              <span className="ml-2 font-medium text-foreground tabular-nums">
                {values.items.length}
              </span>
            </div>
            {categoryQuantityItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                {categoryQuantityItems.map((item) => (
                  <span key={item.label}>
                    {item.label}
                    <span className="ml-1 font-medium text-foreground tabular-nums">
                      {item.value}
                    </span>
                    <span className="ml-0.5">支</span>
                  </span>
                ))}
              </div>
            )}
            <div className="text-muted-foreground">
              数量合计
              <span className="ml-2 font-medium text-foreground tabular-nums">
                {totalQuantity}
              </span>
              <span className="ml-1">支</span>
            </div>
            <div className="text-muted-foreground">
              理论重量合计
              <span className="ml-2 font-semibold text-foreground tabular-nums">
                {formatTheoreticalWeightKg(totalTheoreticalWeightKgX100)}
              </span>
              <span className="ml-1">kg</span>
            </div>
          </div>
        </div>

        {(formError ||
          saveMutation.isError ||
          customersQuery.isError ||
          productsQuery.isError) && (
          <div className="border-t px-4 py-3 text-sm text-destructive">
            {formError ??
              getErrorMessage(saveMutation.error) ??
              getErrorMessage(customersQuery.error) ??
              getErrorMessage(productsQuery.error)}
          </div>
        )}
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open && navigationBlocker.status === "blocked") {
            navigationBlocker.reset?.();
          }
        }}
        open={navigationBlocker.status === "blocked"}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>有未保存修改</DialogTitle>
            <DialogDescription>
              当前订单有未保存修改，离开后这些修改会丢失。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => navigationBlocker.reset?.()}
              size="sm"
              variant="outline"
            >
              继续编辑
            </Button>
            <Button
              onClick={() => navigationBlocker.proceed?.()}
              size="sm"
              variant="destructive"
            >
              放弃并离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            resetItemImportDialog();
          } else {
            setItemImportOpen(true);
          }
        }}
        open={itemImportOpen}
      >
        <DialogContent className="grid max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 xl:max-w-270">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>导入订单明细</DialogTitle>
            <DialogDescription>
              支持 CSV、XLSX、XLS；表头：商品名称、长度(mm)、颜色、数量、备注。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 overflow-auto px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {itemImportFileName || "尚未选择文件"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  商品名称按当前客户商品精确匹配；同一商品、长度、颜色不能重复。
                </div>
              </div>
              <Button
                onClick={() => void selectItemImportFile()}
                size="sm"
                type="button"
                variant="outline"
              >
                <UploadIcon className="size-4" />
                重新选择
              </Button>
            </div>

            {(itemImportErrors.length > 0 ||
              itemImportValidationErrors.length > 0) && (
              <div className="max-h-36 overflow-auto rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {itemImportErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
                {itemImportValidationErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            )}

            {itemImportRows.length > 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                已解析 {itemImportRows.length} 条明细，
                {canConfirmItemImport ? "可导入" : "请先处理标红行"}
              </div>
            )}

            {itemImportPreviewRows.length > 0 && (
              <div className="max-h-[52svh] overflow-auto rounded-lg border">
                <Table className="min-w-225 table-fixed">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-18 px-3">行号</TableHead>
                      <TableHead className="w-55 px-3">商品名称</TableHead>
                      <TableHead className="w-30 px-3 text-right">
                        长度(mm)
                      </TableHead>
                      <TableHead className="w-30 px-3">颜色</TableHead>
                      <TableHead className="w-25 px-3 text-right">
                        数量
                      </TableHead>
                      <TableHead className="w-40 px-3">备注</TableHead>
                      <TableHead className="px-3">校验</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemImportPreviewRows.map((row) => (
                      <TableRow
                        className={cn(
                          row.errors.length > 0 &&
                            "bg-destructive/5 hover:bg-destructive/5",
                        )}
                        key={row.rowNumber}
                      >
                        <TableCell className="px-3 py-2 tabular-nums">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell className="truncate px-3 py-2 font-medium">
                          {row.productName || "-"}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {row.lengthMm || "-"}
                        </TableCell>
                        <TableCell className="truncate px-3 py-2">
                          {row.color || "-"}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right tabular-nums">
                          {row.quantity || "-"}
                        </TableCell>
                        <TableCell className="truncate px-3 py-2 text-muted-foreground">
                          {row.note || "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "px-3 py-2 text-muted-foreground",
                            row.errors.length > 0 && "text-destructive",
                          )}
                        >
                          {row.errors.length > 0
                            ? row.errors.join("；")
                            : "可导入"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="m-0 rounded-none">
            <Button
              onClick={resetItemImportDialog}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={!canConfirmItemImport}
              onClick={confirmItemImport}
              type="button"
            >
              导入到订单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentOrder && (
        <>
          {isOrderPrintReady && (
            <div aria-hidden="true" className="print-root">
              <PrintOrderView
                order={currentOrder}
                totalQuantity={currentOrderTotals.totalQuantity}
                totalTheoreticalWeightKgX100={
                  currentOrderTotals.totalTheoreticalWeightKgX100
                }
                variant="print"
              />
            </div>
          )}

          <Dialog
            onOpenChange={setIsPrintPreviewOpen}
            open={isPrintPreviewOpen}
          >
            <DialogContent className="h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 xl:max-w-295">
              <DialogHeader className="border-b px-4 py-4">
                <DialogTitle>打印预览</DialogTitle>
                <DialogDescription>
                  确认 A4 版式和订单内容无误后再打印。
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 overflow-auto bg-muted/60 p-4">
                <div className="mx-auto w-[297mm] shrink-0 text-[#111827]">
                  <PrintOrderView
                    order={currentOrder}
                    totalQuantity={currentOrderTotals.totalQuantity}
                    totalTheoreticalWeightKgX100={
                      currentOrderTotals.totalTheoreticalWeightKgX100
                    }
                    variant="preview"
                  />
                </div>
              </div>
              <DialogFooter className="m-0 rounded-none">
                <Button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  size="sm"
                  variant="outline"
                >
                  取消
                </Button>
                <Button onClick={() => void printOrder()} size="sm">
                  <Printer className="size-4" />
                  打印
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
