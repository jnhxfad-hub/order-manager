import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Download,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcw,
  Trash2Icon,
  UploadIcon,
  UserPlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState, RetryButton } from "@/components/data-state";
import { EmptyState } from "@/components/empty-state";
import { SearchField } from "@/components/search-field";
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
  assignCustomerProducts,
  createProduct,
  deleteProduct,
  exportProducts,
  importProducts,
  listProductIds,
  listProducts,
  parseProductImportFile,
  setProductCustomers,
  updateProduct,
  type CreateProductPayload,
  type ProductFilterParams,
  type UpdateProductPayload,
} from "@/features/products/api/products-api";
import type { Product } from "@/features/products/types";
import { listCustomers } from "@/features/customers/api/customers-api";
import { Tooltip } from "@/components/ui/tooltip";
import { isTauriRuntime } from "@/lib/browser-runtime";
import { createCsv } from "@/lib/csv";
import { formatDateInputValue } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/errors";
import { saveCsvFile } from "@/lib/export-file";
import { getFileNameFromPath } from "@/lib/file-path";
import { formatThicknessMm, formatWeightPerMeterKg } from "@/lib/measurement";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type ProductFormValues = {
  moldCode: string;
  productName: string;
  thicknessMm: string;
  weightPerMeterKg: string;
};

type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;
type AssignNotice = {
  message: string;
  tone: "success" | "warning" | "info";
};
type ProductAssignmentStatus = "all" | "assigned" | "unassigned";

const defaultValues: ProductFormValues = {
  moldCode: "",
  productName: "",
  thicknessMm: "",
  weightPerMeterKg: "",
};

const productPageSizeOptions = [10, 20];
const productAssignmentStatusOptions: Array<{
  label: string;
  value: ProductAssignmentStatus;
}> = [
  { label: "全部归属", value: "all" },
  { label: "已归属客户", value: "assigned" },
  { label: "未分配客户", value: "unassigned" },
];

export function ProductsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(20);
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearch);
  const [productCustomerFilterId, setProductCustomerFilterId] = useState("");
  const [productAssignmentStatus, setProductAssignmentStatus] =
    useState<ProductAssignmentStatus>("all");
  const [formValues, setFormValues] =
    useState<ProductFormValues>(defaultValues);
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [formCustomerIds, setFormCustomerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [importRows, setImportRows] = useState<CreateProductPayload[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [assignNotice, setAssignNotice] = useState<AssignNotice | null>(null);
  const [assignmentProductIds, setAssignmentProductIds] = useState<Set<string>>(
    () => new Set(),
  );
  const queryClient = useQueryClient();
  const productFilterParams: ProductFilterParams = {
    assignmentStatus:
      productAssignmentStatus === "all" ? undefined : productAssignmentStatus,
    customerId: productCustomerFilterId || undefined,
    search: debouncedProductSearch,
  };
  const productListParams = {
    ...productFilterParams,
    page: productPage,
    pageSize: productPageSize,
  };

  const productsQuery = useQuery({
    queryKey: [
      "products",
      productPage,
      productPageSize,
      debouncedProductSearch,
      productCustomerFilterId,
      productAssignmentStatus,
    ],
    placeholderData: (previousData) => previousData,
    queryFn: () => listProducts(productListParams),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "product-form"],
    queryFn: () => listCustomers({ page: 1, pageSize: 1000 }),
  });

  const createProductMutation = useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const product = await createProduct(payload);
      const customerIds = Array.from(formCustomerIds);

      if (customerIds.length === 0) {
        return product;
      }

      return setProductCustomers({ productId: product.id, customerIds });
    },
    onSuccess: () => resetAfterWrite(),
  });

  const updateProductMutation = useMutation({
    mutationFn: async (payload: UpdateProductPayload) => {
      await updateProduct(payload);
      return setProductCustomers({
        productId: payload.id,
        customerIds: Array.from(formCustomerIds),
      });
    },
    onSuccess: () => resetAfterWrite(),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (productToDelete) {
        setAssignmentProductIds((current) => {
          const next = new Set(current);
          next.delete(productToDelete.id);
          return next;
        });
      }
      setProductToDelete(null);
    },
  });

  const importProductsMutation = useMutation({
    mutationFn: (products: CreateProductPayload[]) =>
      importProducts({ products }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      resetImportDialog();
    },
  });
  const exportProductsMutation = useMutation({
    mutationFn: async () => {
      const result = await exportProducts(productFilterParams);
      const csv = createCsv([
        ["商品名称", "模具编号", "厚度(mm)", "米重(kg/m)", "归属客户"],
        ...result.products.map((product) => [
          product.productName,
          product.moldCode,
          formatThicknessMm(product.thicknessMmX100),
          formatWeightPerMeterKg(product.weightPerMeterKgX1000),
          product.assignedCustomerNames.join("、") || "未分配客户",
        ]),
      ]);

      await saveCsvFile({
        contents: csv,
        defaultPath: `商品资料_${formatDateInputValue(new Date())}.csv`,
      });
    },
  });
  const assignProductsMutation = useMutation({
    mutationFn: () =>
      assignCustomerProducts({
        customerId: assignCustomerId,
        productIds: Array.from(assignmentProductIds),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      const tone =
        result.assignedCount === 0
          ? "warning"
          : result.skippedCount === 0
            ? "success"
            : "info";
      const message =
        result.assignedCount === 0
          ? `未新增分配：${result.skippedCount} 条商品已归属该客户。`
          : `分配完成：新增 ${result.assignedCount} 条，跳过已归属 ${result.skippedCount} 条。`;

      setAssignNotice({ message, tone });
      setAssignmentProductIds(new Set());
      setAssignOpen(false);
      setAssignCustomerId("");
    },
  });
  const markFilteredProductsForAssignmentMutation = useMutation({
    mutationFn: () => listProductIds(productFilterParams),
    onSuccess: (result) => {
      setAssignmentProductIds(new Set(result.ids));
    },
  });

  const products = productsQuery.data?.products ?? [];
  const customers = customersQuery.data?.customers ?? [];
  const assignCustomer =
    customers.find((customer) => customer.id === assignCustomerId) ?? null;
  const productFilterCustomer =
    customers.find((customer) => customer.id === productCustomerFilterId) ??
    null;
  const hasProductFilters =
    Boolean(productSearch.trim()) ||
    Boolean(productCustomerFilterId) ||
    productAssignmentStatus !== "all";
  const assignmentProductsOnPage = products.filter((product) =>
    assignmentProductIds.has(product.id),
  );
  const alreadyAssignedToTargetCustomerCount = assignCustomer
    ? assignmentProductsOnPage.filter((product) =>
        product.assignedCustomerIds.includes(assignCustomer.id),
      ).length
    : 0;
  const productTotal = productsQuery.data?.total ?? 0;
  const productPageCount = Math.max(
    1,
    Math.ceil(productTotal / productPageSize),
  );
  const productStart =
    productTotal === 0 ? 0 : (productPage - 1) * productPageSize + 1;
  const productEnd = Math.min(productPage * productPageSize, productTotal);
  const assignmentProductCount = assignmentProductIds.size;
  const allFilteredProductsMarkedForAssignment =
    productTotal > 0 && assignmentProductCount === productTotal;
  const someFilteredProductsMarkedForAssignment =
    assignmentProductCount > 0 && assignmentProductCount < productTotal;
  const writeError =
    getErrorMessage(createProductMutation.error) ??
    getErrorMessage(updateProductMutation.error);
  const isWriting =
    createProductMutation.isPending || updateProductMutation.isPending;

  useEffect(() => {
    if (productsQuery.data && productPage > productPageCount) {
      setProductPage(productPageCount);
    }
  }, [productPage, productPageCount, productsQuery.data]);

  useEffect(() => {
    if (!assignNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAssignNotice(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [assignNotice]);

  function resetAfterWrite() {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setFormValues(defaultValues);
    setFormErrors({});
    setFormCustomerIds(new Set());
    setEditingProduct(null);
    setFormOpen(false);
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setFormValues(defaultValues);
    setFormErrors({});
    setFormCustomerIds(new Set());
    createProductMutation.reset();
    updateProductMutation.reset();
    setFormOpen(true);
  }

  function resetImportDialog() {
    setImportOpen(false);
    setImportRows([]);
    setImportErrors([]);
    setImportFileName("");
    importProductsMutation.reset();
  }

  function handleAssignOpenChange(nextOpen: boolean) {
    setAssignOpen(nextOpen);

    if (!nextOpen) {
      setAssignCustomerId("");
      assignProductsMutation.reset();
    }
  }

  function toggleProductAssignmentSelection(id: string, checked: boolean) {
    setAssignmentProductIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function toggleFilteredProductAssignmentSelection(checked: boolean) {
    if (checked) {
      markFilteredProductsForAssignmentMutation.mutate();
      return;
    }

    setAssignmentProductIds(new Set());
  }

  function resetAssignmentSelectionForFilterChange() {
    setAssignmentProductIds(new Set());
    markFilteredProductsForAssignmentMutation.reset();
  }

  function exportCurrentProducts() {
    exportProductsMutation.reset();
    exportProductsMutation.mutate();
  }

  async function selectImportFile() {
    importProductsMutation.reset();
    setImportRows([]);
    setImportErrors([]);

    if (!isTauriRuntime()) {
      setImportErrors(["系统文件选择器只能在 Tauri 应用窗口中使用。"]);
      return;
    }

    try {
      const selected = await openFileDialog({
        title: "选择商品导入文件",
        multiple: false,
        fileAccessMode: "scoped",
      });

      if (typeof selected !== "string") {
        return;
      }

      const result = await parseProductImportFile(selected);
      setImportFileName(getFileNameFromPath(selected));
      setImportRows(result.products);
      setImportErrors(result.errors);
    } catch (error) {
      const fallbackMessage =
        "无法读取文件，请确认选择的是 CSV、XLSX 或 XLS 文件后重试。";
      setImportErrors([
        getErrorMessage(error, fallbackMessage) ?? fallbackMessage,
      ]);
    }
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setFormValues({
      moldCode: product.moldCode,
      productName: product.productName,
      thicknessMm: formatThicknessMm(product.thicknessMmX100),
      weightPerMeterKg: formatWeightPerMeterKg(product.weightPerMeterKgX1000),
    });
    setFormErrors({});
    setFormCustomerIds(new Set(product.assignedCustomerIds));
    createProductMutation.reset();
    updateProductMutation.reset();
    setFormOpen(true);
  }

  function handleFormOpenChange(nextOpen: boolean) {
    setFormOpen(nextOpen);
    if (!nextOpen) {
      setEditingProduct(null);
      setFormValues(defaultValues);
      setFormErrors({});
      setFormCustomerIds(new Set());
      createProductMutation.reset();
      updateProductMutation.reset();
    }
  }

  function updateFormValue<Key extends keyof ProductFormValues>(
    key: Key,
    value: ProductFormValues[Key],
  ) {
    setFormValues((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
    createProductMutation.reset();
    updateProductMutation.reset();
  }

  function toggleFormCustomer(customerId: string, checked: boolean) {
    setFormCustomerIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(customerId);
      } else {
        next.delete(customerId);
      }

      return next;
    });
    createProductMutation.reset();
    updateProductMutation.reset();
  }

  function validateForm(values: ProductFormValues) {
    const errors: ProductFormErrors = {};
    const thicknessMm = Number(values.thicknessMm);
    const weightPerMeterKg = Number(values.weightPerMeterKg);

    if (!values.productName.trim()) {
      errors.productName = "请输入商品名称";
    }

    if (!values.moldCode.trim()) {
      errors.moldCode = "请输入模具编号";
    }

    if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) {
      errors.thicknessMm = "厚度必须大于 0";
    }

    if (!Number.isFinite(weightPerMeterKg) || weightPerMeterKg <= 0) {
      errors.weightPerMeterKg = "米重必须大于 0";
    }

    return { errors, thicknessMm, weightPerMeterKg };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, thicknessMm, weightPerMeterKg } = validateForm(formValues);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      moldCode: formValues.moldCode.trim(),
      productName: formValues.productName.trim(),
      thicknessMmX100: Math.round(thicknessMm * 100),
      weightPerMeterKgX1000: Math.round(weightPerMeterKg * 1000),
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, ...payload });
      return;
    }

    createProductMutation.mutate(payload);
  }

  return (
    <div className="workspace-page list-page">
      {assignNotice && (
        <div
          className={`fixed left-1/2 top-[calc(50%-170px)] z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 rounded-md border px-4 py-2.5 text-center text-sm shadow-xl ${getAssignNoticeClassName(assignNotice.tone)}`}
          role="status"
        >
          {assignNotice.message}
        </div>
      )}

      <div className="workspace-list-grid grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <SectionHeading
            badge={`${productTotal} 条`}
            icon={<PackageIcon className="size-4" />}
            title="商品概览"
          />
          <div className="mt-4 space-y-3">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {hasProductFilters ? "筛选结果" : "商品数量"}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {productTotal}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">当前页</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {products.length}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">已选择</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {assignmentProductCount}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            {productAssignmentStatusOptions.map((option) => (
              <Button
                className="h-8 w-full justify-start"
                key={option.value}
                onClick={() => {
                  setProductAssignmentStatus(option.value);
                  resetAssignmentSelectionForFilterChange();
                  setProductPage(1);
                }}
                size="sm"
                variant={
                  productAssignmentStatus === option.value
                    ? "secondary"
                    : "ghost"
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </aside>

        <section className="workspace-card overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <SectionHeading
              badge={`${productTotal} 条`}
              description="商品资料先统一维护，再批量分配给客户用于下单选择。"
              title="商品资料"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                aria-label="刷新商品"
                onClick={() => productsQuery.refetch()}
                size="icon-sm"
                variant="outline"
              >
                <RefreshCcw className="size-4" />
              </Button>
              <Button className="h-8" onClick={openCreateDialog} size="sm">
                <PlusIcon className="size-4" />
                新增商品
              </Button>
              <span className="group relative inline-flex">
                <Button
                  className="h-8"
                  disabled={assignmentProductCount === 0}
                  onClick={() => {
                    setAssignNotice(null);
                    handleAssignOpenChange(true);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <UserPlusIcon className="size-4" />
                  分配客户
                </Button>
                {assignmentProductCount === 0 && (
                  <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-20 hidden w-max -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 shadow-md group-hover:block">
                    请先选择商品
                  </span>
                )}
              </span>
              <Button
                className="h-8"
                disabled={exportProductsMutation.isPending || productTotal === 0}
                onClick={exportCurrentProducts}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" />
                批量导出
              </Button>
              <Button
                className="h-8"
                onClick={() => setImportOpen(true)}
                size="sm"
                variant="outline"
              >
                <UploadIcon className="size-4" />
                批量导入
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-3">
            <SearchField
              onChange={(value) => {
                setProductSearch(value);
                resetAssignmentSelectionForFilterChange();
                setProductPage(1);
              }}
              placeholder="搜索名称、模具编号"
              value={productSearch}
            />
            <Select
              clearable
              disabled={customersQuery.isLoading || customers.length === 0}
              onValueChange={(value) => {
                setProductCustomerFilterId(value ?? "");
                resetAssignmentSelectionForFilterChange();
                setProductPage(1);
              }}
              value={productCustomerFilterId}
            >
              <SelectTrigger className="w-48" size="sm">
                <SelectValue>
                  {() => productFilterCustomer?.customerName || "全部客户"}
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
            {assignmentProductCount > 0 && (
              <div className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 tabular-nums">
                当前选择 {assignmentProductCount} 条商品
              </div>
            )}
          </div>

          {exportProductsMutation.isError && (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              导出失败：
              {getErrorMessage(exportProductsMutation.error) ??
                "请稍后重试。"}
            </div>
          )}

          {markFilteredProductsForAssignmentMutation.isError && (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              选择当前筛选结果失败：
              {getErrorMessage(
                markFilteredProductsForAssignmentMutation.error,
              ) ?? "请稍后重试。"}
            </div>
          )}

          {productsQuery.isLoading ? (
            <LoadingState title="正在读取商品资料" />
          ) : productsQuery.isError ? (
            <ErrorState
              action={
                <RetryButton
                  disabled={productsQuery.isFetching}
                  onClick={() => void productsQuery.refetch()}
                />
              }
              description={getErrorMessage(productsQuery.error)}
              title="读取商品失败"
            />
          ) : (
            <>
              <Table className="min-w-200 table-fixed">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 px-3 text-center">
                      <input
                        aria-label="选择当前筛选结果全部商品"
                        checked={allFilteredProductsMarkedForAssignment}
                        className="size-4 rounded border-border accent-primary"
                        disabled={
                          productTotal === 0 ||
                          markFilteredProductsForAssignmentMutation.isPending
                        }
                        onChange={(event) =>
                          toggleFilteredProductAssignmentSelection(
                            event.target.checked,
                          )
                        }
                        ref={(element) => {
                          if (element) {
                            element.indeterminate =
                              someFilteredProductsMarkedForAssignment &&
                              !allFilteredProductsMarkedForAssignment;
                          }
                        }}
                        type="checkbox"
                      />
                    </TableHead>
                    <TableHead className="w-[24%] px-3">
                      商品名称
                    </TableHead>
                    <TableHead className="w-[14%] px-3">
                      模具编号
                    </TableHead>
                    <TableHead className="w-[10%] px-3 text-right">
                      厚度(mm)
                    </TableHead>
                    <TableHead className="w-[12%] px-3 text-right">
                      米重(kg/m)
                    </TableHead>
                    <TableHead className="px-3 text-center">
                      归属客户
                    </TableHead>
                    <TableHead className="w-24 px-3 text-center">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell className="p-0" colSpan={7}>
                        <EmptyState
                          action={
                            hasProductFilters ? (
                              <Button
                                onClick={() => {
                                  setProductSearch("");
                                  setProductCustomerFilterId("");
                                  setProductAssignmentStatus("all");
                                  resetAssignmentSelectionForFilterChange();
                                  setProductPage(1);
                                }}
                                size="sm"
                                variant="outline"
                              >
                                清空筛选
                              </Button>
                            ) : (
                              <>
                                <Button onClick={openCreateDialog} size="sm">
                                  <PlusIcon className="size-4" />
                                  新增商品
                                </Button>
                                <Button
                                  onClick={() => setImportOpen(true)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <UploadIcon className="size-4" />
                                  批量导入
                                </Button>
                              </>
                            )
                          }
                          description={
                            hasProductFilters
                              ? "调整名称、模具编号、客户或归属状态后再试。"
                              : "先维护全局商品库，再把商品批量分配给客户。"
                          }
                          icon={<PackageIcon className="size-4" />}
                          title={
                            hasProductFilters
                              ? "没有找到商品"
                              : "还没有商品资料"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="px-3 py-3">
                          <input
                            aria-label={`选择商品 ${product.productName}`}
                            checked={assignmentProductIds.has(product.id)}
                            className="size-4 rounded border-border accent-primary"
                            onChange={(event) =>
                              toggleProductAssignmentSelection(
                                product.id,
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                        </TableCell>
                        <TableCell className="truncate px-3 py-3 font-medium">
                          {product.productName}
                        </TableCell>
                        <TableCell className="px-3 py-3 font-mono text-sm">
                          {product.moldCode}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right tabular-nums">
                          {formatThicknessMm(product.thicknessMmX100)}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right tabular-nums">
                          {formatWeightPerMeterKg(
                            product.weightPerMeterKgX1000,
                          )}
                        </TableCell>
                        <TableCell className="truncate px-3 py-3 text-center text-muted-foreground">
                          {product.assignedCustomerNames.length > 0
                            ? product.assignedCustomerNames.join("、")
                            : "未分配客户"}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip align="end" content="编辑商品" side="top">
                              <Button
                                aria-label="编辑商品"
                                onClick={() => openEditDialog(product)}
                                size="icon-xs"
                                variant="ghost"
                              >
                                <PencilIcon className="size-4" />
                              </Button>
                            </Tooltip>
                            <Tooltip align="end" content="删除商品" side="top">
                              <Button
                                aria-label="删除商品"
                                onClick={() => setProductToDelete(product)}
                                size="icon-xs"
                                variant="ghost-destructive"
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
                <div>
                  共 {productTotal} 条，当前 {productStart}-{productEnd} 条
                  {assignmentProductCount > 0
                    ? `，已选择 ${assignmentProductCount} 条`
                    : ""}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span>每页</span>
                    <Select
                      onValueChange={(value) => {
                        if (!value) {
                          return;
                        }

                        setProductPageSize(Number.parseInt(value, 10));
                        setProductPage(1);
                      }}
                      value={`${productPageSize} 条`}
                    >
                      <SelectTrigger
                        aria-label="每页显示条数"
                        className="w-24"
                        size="sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {productPageSizeOptions.map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize} 条`}>
                            {pageSize} 条
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label="上一页"
                      disabled={productPage <= 1}
                      onClick={() =>
                        setProductPage((current) => Math.max(1, current - 1))
                      }
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <div className="min-w-20 text-center">
                      {productPage} / {productPageCount}
                    </div>
                    <Button
                      aria-label="下一页"
                      disabled={productPage >= productPageCount}
                      onClick={() =>
                        setProductPage((current) =>
                          Math.min(productPageCount, current + 1),
                        )
                      }
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog onOpenChange={handleFormOpenChange} open={formOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "编辑商品" : "新增商品"}
              </DialogTitle>
              <DialogDescription>
                名称用于下单选择，模具编号用于生产识别。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="product-name">商品名称</Label>
                <Input
                  id="product-name"
                  onChange={(event) =>
                    updateFormValue("productName", event.target.value)
                  }
                  placeholder="例如：70 边框（1.15）-- 外"
                  value={formValues.productName}
                />
                <FieldError message={formErrors.productName} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-mold-code">模具编号</Label>
                <Input
                  id="product-mold-code"
                  onChange={(event) =>
                    updateFormValue("moldCode", event.target.value)
                  }
                  placeholder="例如：G5501"
                  value={formValues.moldCode}
                />
                <FieldError message={formErrors.moldCode} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-thickness">厚度 mm</Label>
                  <Input
                    id="product-thickness"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateFormValue("thicknessMm", event.target.value)
                    }
                    placeholder="1.15"
                    step="0.01"
                    type="number"
                    value={formValues.thicknessMm}
                  />
                  <FieldError message={formErrors.thicknessMm} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product-weight">米重 kg/m</Label>
                  <Input
                    id="product-weight"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateFormValue("weightPerMeterKg", event.target.value)
                    }
                    placeholder="2.350"
                    step="0.001"
                    type="number"
                    value={formValues.weightPerMeterKg}
                  />
                  <FieldError message={formErrors.weightPerMeterKg} />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>归属客户</Label>
                  <span className="text-xs text-muted-foreground">
                    归属 {formCustomerIds.size} 个
                  </span>
                </div>
                {customersQuery.isLoading ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                    正在读取客户列表
                  </div>
                ) : customers.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                    当前客户列表为空，请新建客户后再分配。
                  </div>
                ) : (
                  <div className="max-h-44 overflow-auto rounded-md border bg-muted/20 p-2">
                    <div className="grid gap-1">
                      {customers.map((customer) => (
                        <label
                          className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-background"
                          key={customer.id}
                        >
                          <input
                            checked={formCustomerIds.has(customer.id)}
                            className="size-4 rounded border-border accent-primary"
                            onChange={(event) =>
                              toggleFormCustomer(
                                customer.id,
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                          <span className="truncate">
                            {customer.customerName}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {writeError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {writeError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                disabled={isWriting}
                onClick={() => handleFormOpenChange(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button disabled={isWriting} type="submit">
                {isWriting ? "保存中" : "保存商品"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={handleAssignOpenChange} open={assignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分配客户</DialogTitle>
            <DialogDescription>
              将选择的 {assignmentProductCount} 条商品加入客户商品列表。
            </DialogDescription>
          </DialogHeader>

          {customersQuery.isLoading ? (
            <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              正在读取客户列表
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
              当前客户列表为空，请新建客户后再分配。
            </div>
          ) : (
            <div className="grid gap-2 py-2">
              <Label htmlFor="assign-customer">客户</Label>
              <Select
                clearable
                onValueChange={(value) => {
                  if (value) {
                    setAssignCustomerId(value);
                    assignProductsMutation.reset();
                  } else {
                    setAssignCustomerId("");
                  }
                }}
                value={assignCustomerId}
              >
                <SelectTrigger className="w-full" id="assign-customer">
                  <SelectValue>
                    {() => assignCustomer?.customerName || "选择客户"}
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
              {alreadyAssignedToTargetCustomerCount > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  当前页已选商品中有 {alreadyAssignedToTargetCustomerCount}{" "}
                  条已归属该客户，确认分配时会自动跳过。
                </div>
              )}
            </div>
          )}

          {assignProductsMutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(assignProductsMutation.error)}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={assignProductsMutation.isPending}
              onClick={() => handleAssignOpenChange(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={
                assignProductsMutation.isPending ||
                !assignCustomerId ||
                customers.length === 0 ||
                assignmentProductCount === 0
              }
              onClick={() => assignProductsMutation.mutate()}
              type="button"
            >
              {assignProductsMutation.isPending ? "分配中" : "确认分配"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setProductToDelete(null);
            deleteProductMutation.reset();
          }
        }}
        open={Boolean(productToDelete)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除商品</DialogTitle>
            <DialogDescription>
              删除后商品会从可选商品和所有客户归属中移除，后续不能再用于新订单，且不能直接撤销。已下单订单、库存流水和出库单会保留商品快照或历史引用。
            </DialogDescription>
          </DialogHeader>

          {productToDelete && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {productToDelete.productName} / {productToDelete.moldCode}
            </div>
          )}

          {deleteProductMutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(deleteProductMutation.error)}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={deleteProductMutation.isPending}
              onClick={() => setProductToDelete(null)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={deleteProductMutation.isPending || !productToDelete}
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation.mutate(productToDelete.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              {deleteProductMutation.isPending ? "删除中" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            resetImportDialog();
          } else {
            setImportOpen(true);
          }
        }}
        open={importOpen}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量导入商品</DialogTitle>
            <DialogDescription>
              支持 CSV、XLSX、XLS；表头：商品名称、模具编号、厚度、米重，归属客户可选。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm ring-1 ring-border">
                <UploadIcon className="size-5" />
              </div>
              <div className="mt-3 text-sm font-medium">
                选择 CSV / Excel 文件
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                表头需要包含：商品名称、模具编号、厚度、米重；归属客户可选
              </div>
              <Button
                className="mt-4 h-8"
                onClick={selectImportFile}
                type="button"
                variant="outline"
              >
                选择导入文件
              </Button>
              <div className="mt-2 text-xs text-muted-foreground">
                {importFileName || "尚未选择文件"}
              </div>
            </div>

            {importErrors.length > 0 && (
              <div className="max-h-36 overflow-auto rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            )}

            {importRows.length > 0 && importErrors.length === 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                已解析 {importRows.length} 条商品，预览前{" "}
                {Math.min(importRows.length, 20)} 条
              </div>
            )}

            {importRows.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4">商品名称</TableHead>
                      <TableHead className="w-30 px-4">模具编号</TableHead>
                      <TableHead className="w-30 px-4 text-right">
                        厚度 mm
                      </TableHead>
                      <TableHead className="w-32.5 px-4 text-right">
                        米重 kg/m
                      </TableHead>
                      <TableHead className="w-40 px-4">归属客户</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.slice(0, 20).map((product, index) => (
                      <TableRow key={`${product.moldCode}-${index}`}>
                        <TableCell className="px-4 py-2">
                          {product.productName}
                        </TableCell>
                        <TableCell className="px-4 py-2 font-mono text-sm">
                          {product.moldCode}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right tabular-nums">
                          {formatThicknessMm(product.thicknessMmX100)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right tabular-nums">
                          {formatWeightPerMeterKg(
                            product.weightPerMeterKgX1000,
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {product.assignedCustomerNames?.join("、") || "未分配客户"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {importProductsMutation.isError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getErrorMessage(importProductsMutation.error)}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={importProductsMutation.isPending}
              onClick={resetImportDialog}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={
                importProductsMutation.isPending ||
                importRows.length === 0 ||
                importErrors.length > 0
              }
              onClick={() => importProductsMutation.mutate(importRows)}
              type="button"
            >
              {importProductsMutation.isPending ? "导入中" : "导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAssignNoticeClassName(tone: AssignNotice["tone"]) {
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "info") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
