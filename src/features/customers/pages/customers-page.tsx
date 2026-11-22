import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Download,
  PencilIcon,
  PlusIcon,
  RefreshCcw,
  Trash2Icon,
  UploadIcon,
  UsersRound,
} from "lucide-react";

import { SearchField } from "@/components/search-field";
import { SectionHeading } from "@/components/section-heading";
import { MissingPriceTag } from "@/components/missing-price-tag";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState, RetryButton } from "@/components/data-state";
import { EmptyState } from "@/components/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
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
  createCustomer,
  deleteCustomer,
  exportCustomers,
  importCustomers,
  listCustomers,
  parseCustomerImportFile,
  updateCustomer,
  type CustomerFormPayload,
} from "@/features/customers/api/customers-api";
import {
  buildMoneyPayload,
  buildProcessingFeeExportHeaders,
  buildProcessingFeeExportValues,
  customerFormDefaultValues as defaultValues,
  customerToFormValues,
  excludedProcessingFeeFields,
  formatCustomerMoneyX100 as formatMoneyX100,
  getDefaultPricingLabel,
  getDefaultProcessingFees,
  getSpecialProcessingFees,
  hasAnyConfiguredMoney,
  includedProcessingFeeFields,
  parseProcessingFeeValues,
  processingFeeFieldsWithGroupLabels,
  resolveDefaultPricing,
  specialExcludedProcessingFeeFields,
  specialIncludedProcessingFeeFields,
  validateMoney,
  validatePhone,
  type CustomerFormErrors,
  type CustomerFormValues,
  type ProcessingFeeFormKey,
} from "@/features/customers/lib/customer-form-utils";
import type { Customer } from "@/features/customers/types";
import { isTauriRuntime } from "@/lib/browser-runtime";
import { createCsv } from "@/lib/csv";
import { formatDateInputValue } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/errors";
import { saveCsvFile } from "@/lib/export-file";
import { getFileNameFromPath } from "@/lib/file-path";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

type CustomerQuickFilter = "all" | "missingPhone" | "missingAddress";

const customerPageSizeOptions = [10, 20];
const quickFilters: Array<{ label: string; value: CustomerQuickFilter }> = [
  { label: "全部", value: "all" },
  { label: "缺手机号", value: "missingPhone" },
  { label: "缺地址", value: "missingAddress" },
];

function renderProcessingFeeInputs({
  fields,
  formErrors,
  formValues,
  groupLabel,
  updateMoneyValue,
}: {
  fields: Array<{ id: string; key: ProcessingFeeFormKey; label: string }>;
  formErrors: CustomerFormErrors;
  formValues: CustomerFormValues;
  groupLabel: string;
  updateMoneyValue: (
    key: ProcessingFeeFormKey,
    value: string,
    label: string,
  ) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {fields.map((field) => (
        <div className="space-y-2" key={field.key}>
          <Label htmlFor={field.id}>{field.label}</Label>
          <div className="relative">
            <Input
              aria-invalid={Boolean(formErrors[field.key])}
              aria-describedby={
                formErrors[field.key] ? `${field.id}-error` : undefined
              }
              className={cn(formErrors[field.key] && "pr-20")}
              id={field.id}
              inputMode="decimal"
              placeholder="0.00"
              value={formValues[field.key]}
              onChange={(event) =>
                updateMoneyValue(
                  field.key,
                  event.target.value,
                  `${groupLabel}${field.label}加工费`,
                )
              }
            />
            <InlineInputError
              id={`${field.id}-error`}
              message={formErrors[field.key] ? "只能输入数字" : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProcessingFeeSummary({ customer }: { customer: Customer }) {
  const defaultFees = getDefaultProcessingFees(customer);
  const specialFees = getSpecialProcessingFees(customer);

  if (defaultFees.length === 0) {
    return <span className="text-muted-foreground">未设置</span>;
  }

  return (
    <div className="space-y-1 text-xs leading-5">
      <ProcessingFeeSummaryRow label="默认" fees={defaultFees} />
      {specialFees.length > 0 && (
        <ProcessingFeeSummaryRow
          label={customer.specialPricingKeyword}
          fees={specialFees}
          muted
        />
      )}
    </div>
  );
}

function ProcessingFeeSummaryRow({
  fees,
  label,
  muted = false,
}: {
  fees: Array<{ category: string; value: number }>;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <span
        className={cn(
          "inline-flex h-5 max-w-full items-center rounded border px-1.5 text-[11px] font-normal leading-none",
          muted
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-border bg-muted/30 text-muted-foreground",
        )}
        title={label}
      >
        <span className="truncate">{label}</span>
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {fees.map((fee) => (
          <span
            className="inline-grid grid-cols-[2rem_3.75rem] items-baseline gap-1 whitespace-nowrap"
            key={fee.category}
          >
            <span className="text-muted-foreground">{fee.category}</span>
            <span className="text-right font-medium text-foreground">
              {formatMoneyX100(fee.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function InlineInputError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <span
      aria-live="polite"
      id={id}
      className="pointer-events-none absolute right-2 top-1/2 max-w-[45%] -translate-y-1/2 truncate rounded-sm bg-background/95 px-1.5 text-xs leading-5 text-destructive shadow-[0_0_0_1px_hsl(var(--background))]"
      title={message}
    >
      {message}
    </span>
  );
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(20);
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch);
  const [quickFilter, setQuickFilter] = useState<CustomerQuickFilter>("all");
  const [formValues, setFormValues] =
    useState<CustomerFormValues>(defaultValues);
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<CustomerFormPayload[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const customerListParams = {
    page: customerPage,
    pageSize: customerPageSize,
    quickFilter,
    search: debouncedCustomerSearch,
  };

  const customersQuery = useQuery({
    queryKey: [
      "customers",
      customerPage,
      customerPageSize,
      debouncedCustomerSearch,
      quickFilter,
    ],
    placeholderData: (previousData) => previousData,
    queryFn: () => listCustomers(customerListParams),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: CustomerFormPayload) => createCustomer(payload),
    onSuccess: () => resetAfterWrite(),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (payload: CustomerFormPayload & { id: string }) =>
      updateCustomer(payload),
    onSuccess: () => resetAfterWrite(),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerToDelete(null);
    },
  });
  const importCustomersMutation = useMutation({
    mutationFn: (customers: CustomerFormPayload[]) =>
      importCustomers({ customers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      resetImportDialog();
    },
  });
  const exportCustomersMutation = useMutation({
    mutationFn: async () => {
      const result = await exportCustomers(customerListParams);
      const csv = createCsv([
        [
          "客户名称",
          "手机",
          "客户地址",
          "默认计价",
          ...buildProcessingFeeExportHeaders(
            "含税",
            includedProcessingFeeFields,
          ),
          ...buildProcessingFeeExportHeaders(
            "不含税",
            excludedProcessingFeeFields,
          ),
          "特殊计价关键词",
          ...buildProcessingFeeExportHeaders(
            "特殊含税",
            specialIncludedProcessingFeeFields,
          ),
          ...buildProcessingFeeExportHeaders(
            "特殊不含税",
            specialExcludedProcessingFeeFields,
          ),
        ],
        ...result.customers.map((customer) => [
          customer.customerName,
          customer.phone,
          customer.customerAddress,
          customer.defaultPricingTaxIncluded ? "含税" : "不含税",
          ...buildProcessingFeeExportValues(
            customer,
            includedProcessingFeeFields,
          ),
          ...buildProcessingFeeExportValues(
            customer,
            excludedProcessingFeeFields,
          ),
          customer.specialPricingKeyword,
          ...buildProcessingFeeExportValues(
            customer,
            specialIncludedProcessingFeeFields,
          ),
          ...buildProcessingFeeExportValues(
            customer,
            specialExcludedProcessingFeeFields,
          ),
        ]),
      ]);

      await saveCsvFile({
        contents: csv,
        defaultPath: `客户资料_${formatDateInputValue(new Date())}.csv`,
      });
    },
  });

  const customers = customersQuery.data?.customers ?? [];
  const customerTotal = customersQuery.data?.total ?? 0;
  const allCustomerTotal = customersQuery.data?.allTotal ?? customerTotal;
  const missingPhoneCount = customersQuery.data?.missingPhoneCount ?? 0;
  const missingAddressCount = customersQuery.data?.missingAddressCount ?? 0;
  const visibleCustomerTotal = customerTotal;
  const hasCustomerFilters =
    Boolean(customerSearch.trim()) || quickFilter !== "all";
  const customerPageCount = Math.max(
    1,
    Math.ceil(customerTotal / customerPageSize),
  );
  const customerStart =
    customerTotal === 0 ? 0 : (customerPage - 1) * customerPageSize + 1;
  const customerEnd = Math.min(customerPage * customerPageSize, customerTotal);
  const writeError = createCustomerMutation.error
    ? getErrorMessage(createCustomerMutation.error)
    : updateCustomerMutation.error
      ? getErrorMessage(updateCustomerMutation.error)
      : null;
  const isWriting =
    createCustomerMutation.isPending || updateCustomerMutation.isPending;
  const hasIncludedPrice = hasAnyConfiguredMoney(
    formValues,
    includedProcessingFeeFields,
  );
  const hasExcludedPrice = hasAnyConfiguredMoney(
    formValues,
    excludedProcessingFeeFields,
  );
  const isDefaultPricingSelectDisabled = !hasIncludedPrice && !hasExcludedPrice;

  useEffect(() => {
    if (customersQuery.data && customerPage > customerPageCount) {
      setCustomerPage(customerPageCount);
    }
  }, [customerPage, customerPageCount, customersQuery.data]);

  useEffect(() => {
    const nextDefaultPricing = resolveDefaultPricing(
      formValues.defaultPricingTaxIncluded,
      hasIncludedPrice,
      hasExcludedPrice,
    );

    if (nextDefaultPricing.value !== formValues.defaultPricingTaxIncluded) {
      setFormValues((current) => {
        if (
          current.defaultPricingTaxIncluded !==
          formValues.defaultPricingTaxIncluded
        ) {
          return current;
        }

        return {
          ...current,
          defaultPricingTaxIncluded: nextDefaultPricing.value,
        };
      });
    }

    setFormErrors((current) => {
      if (current.defaultPricingTaxIncluded === nextDefaultPricing.error) {
        return current;
      }

      if (!current.defaultPricingTaxIncluded && !nextDefaultPricing.error) {
        return current;
      }

      return {
        ...current,
        defaultPricingTaxIncluded: nextDefaultPricing.error,
      };
    });
  }, [formValues, hasExcludedPrice, hasIncludedPrice]);

  function resetAfterWrite() {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    setFormValues(defaultValues);
    setFormErrors({});
    setEditingCustomer(null);
    setFormOpen(false);
  }

  function resetImportDialog() {
    setImportOpen(false);
    setImportRows([]);
    setImportErrors([]);
    setImportFileName("");
    importCustomersMutation.reset();
  }

  function openCreateDialog() {
    setEditingCustomer(null);
    setFormValues(defaultValues);
    setFormErrors({});
    createCustomerMutation.reset();
    updateCustomerMutation.reset();
    setFormOpen(true);
  }

  function exportCurrentCustomers() {
    exportCustomersMutation.reset();
    exportCustomersMutation.mutate();
  }

  async function selectImportFile() {
    importCustomersMutation.reset();
    setImportRows([]);
    setImportErrors([]);

    if (!isTauriRuntime()) {
      setImportErrors(["系统文件选择器只能在 Tauri 应用窗口中使用。"]);
      return;
    }

    try {
      const selected = await openFileDialog({
        title: "选择客户导入文件",
        multiple: false,
        fileAccessMode: "scoped",
      });

      if (typeof selected !== "string") {
        return;
      }

      const result = await parseCustomerImportFile(selected);
      setImportFileName(getFileNameFromPath(selected));
      setImportRows(result.customers);
      setImportErrors(result.errors);
    } catch (error) {
      const fallbackMessage =
        "无法读取文件，请确认选择的是 CSV、XLSX 或 XLS 文件后重试。";
      setImportErrors([
        getErrorMessage(error, fallbackMessage) ?? fallbackMessage,
      ]);
    }
  }

  function renderCustomerEmptyAction() {
    if (hasCustomerFilters) {
      return (
        <Button
          onClick={() => {
            setCustomerPage(1);
            setCustomerSearch("");
            setQuickFilter("all");
          }}
          size="sm"
          variant="outline"
        >
          清空筛选
        </Button>
      );
    }

    return (
      <>
        <Button onClick={openCreateDialog} size="sm">
          <PlusIcon className="size-4" />
          新增客户
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
    );
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    setFormValues(customerToFormValues(customer));
    setFormErrors({});
    createCustomerMutation.reset();
    updateCustomerMutation.reset();
    setFormOpen(true);
  }

  function handleFormOpenChange(nextOpen: boolean) {
    setFormOpen(nextOpen);

    if (!nextOpen) {
      setEditingCustomer(null);
      setFormValues(defaultValues);
      setFormErrors({});
      createCustomerMutation.reset();
      updateCustomerMutation.reset();
    }
  }

  function updateFormValue<Key extends keyof CustomerFormValues>(
    key: Key,
    value: CustomerFormValues[Key],
  ) {
    setFormValues((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
    createCustomerMutation.reset();
    updateCustomerMutation.reset();
  }

  function updatePhoneValue(value: string) {
    setFormValues((current) => ({ ...current, phone: value }));
    setFormErrors((current) => ({
      ...current,
      phone: validatePhone(value) ?? undefined,
    }));
    createCustomerMutation.reset();
    updateCustomerMutation.reset();
  }

  function updateMoneyValue(
    key: ProcessingFeeFormKey,
    value: string,
    label: string,
  ) {
    setFormValues((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({
      ...current,
      [key]: validateMoney(value, label) ?? undefined,
    }));
    createCustomerMutation.reset();
    updateCustomerMutation.reset();
  }

  function submitCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: CustomerFormErrors = {};

    if (!formValues.customerName.trim()) {
      errors.customerName = "请输入客户名称";
    }

    const phoneError = validatePhone(formValues.phone);

    if (phoneError) {
      errors.phone = phoneError;
    }

    const parsedFees = parseProcessingFeeValues(formValues);

    for (const field of processingFeeFieldsWithGroupLabels) {
      if (parsedFees[field.key] === null) {
        errors[field.key] =
          validateMoney(
            formValues[field.key],
            `${field.groupLabel}${field.label}加工费`,
          ) ?? undefined;
      }
    }

    if (!formValues.defaultPricingTaxIncluded) {
      errors.defaultPricingTaxIncluded = "请先设置价格后选择默认计价";
    } else if (
      formValues.defaultPricingTaxIncluded === "included" &&
      includedProcessingFeeFields.every(
        (field) => (parsedFees[field.key] ?? 0) <= 0,
      )
    ) {
      errors.defaultPricingTaxIncluded = "含税加工费未设置，不能选含税";
    } else if (
      formValues.defaultPricingTaxIncluded === "excluded" &&
      excludedProcessingFeeFields.every(
        (field) => (parsedFees[field.key] ?? 0) <= 0,
      )
    ) {
      errors.defaultPricingTaxIncluded = "不含税加工费未设置，不能选不含税";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      customerAddress: formValues.customerAddress.trim(),
      customerName: formValues.customerName.trim(),
      defaultPricingTaxIncluded:
        formValues.defaultPricingTaxIncluded === "included",
      phone: formValues.phone.trim(),
      specialPricingKeyword: formValues.specialPricingKeyword.trim(),
      ...buildMoneyPayload(parsedFees),
    } as CustomerFormPayload;

    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, ...payload });
      return;
    }

    createCustomerMutation.mutate(payload);
  }

  return (
    <div className="workspace-page list-page">
      <div className="workspace-list-grid grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <SectionHeading
            badge={`${allCustomerTotal} 条`}
            icon={<UsersRound className="size-4" />}
            title="客户概览"
          />
          <div className="mt-4 space-y-3">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">客户数量</div>
              <div className="mt-1 text-xl font-semibold">{allCustomerTotal}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">缺手机号</div>
                <div className="mt-1 text-lg font-semibold">
                  {missingPhoneCount}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">缺地址</div>
                <div className="mt-1 text-lg font-semibold">
                  {missingAddressCount}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {quickFilters.map((filter) => (
              <Button
                className="h-8 w-full justify-start"
                key={filter.value}
                onClick={() => {
                  setCustomerPage(1);
                  setQuickFilter(filter.value);
                }}
                size="sm"
                variant={quickFilter === filter.value ? "secondary" : "ghost"}
              >
                <span className="flex-1 text-left">{filter.label}</span>
                {filter.value === "missingPhone" && (
                  <span className="tabular-nums">{missingPhoneCount}</span>
                )}
                {filter.value === "missingAddress" && (
                  <span className="tabular-nums">{missingAddressCount}</span>
                )}
              </Button>
            ))}
          </div>
        </aside>

        <section className="workspace-card overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <SectionHeading
              badge={`${visibleCustomerTotal} 条`}
              description="维护客户名称、手机、地址和默认加工费，下单时可复用客户资料。"
              icon={<UsersRound className="size-4" />}
              title="客户资料"
            />
            <div className="flex items-center gap-2">
              <Button
                disabled={customersQuery.isFetching}
                onClick={() => customersQuery.refetch()}
                size="sm"
                variant="outline"
              >
                <RefreshCcw
                  className={
                    customersQuery.isFetching ? "size-4 animate-spin" : "size-4"
                  }
                />
                刷新
              </Button>
              <Button
                className="h-8"
                disabled={exportCustomersMutation.isPending || customerTotal === 0}
                onClick={exportCurrentCustomers}
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
              <Button className="h-8" onClick={openCreateDialog} size="sm">
                <PlusIcon className="size-4" />
                新增客户
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <SearchField
              onChange={(value) => {
                setCustomerPage(1);
                setCustomerSearch(value);
              }}
              placeholder="搜索客户名称、手机、地址"
              value={customerSearch}
            />
          </div>

          {customersQuery.isLoading ? (
            <LoadingState title="正在读取客户资料" />
          ) : customersQuery.isError ? (
            <ErrorState
              action={
                <RetryButton
                  disabled={customersQuery.isFetching}
                  onClick={() => void customersQuery.refetch()}
                />
              }
              description={getErrorMessage(customersQuery.error)}
              title="读取客户失败"
            />
          ) : (
            <Table className="w-full table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-[17%] px-4">
                    客户名称
                  </TableHead>
                  <TableHead className="w-[14%] px-4">手机</TableHead>
                  <TableHead className="w-[16%] px-4">客户地址</TableHead>
                  <TableHead className="w-[10%] px-4">默认计价</TableHead>
                  <TableHead className="w-[33%] px-4">默认加工费</TableHead>
                  <TableHead className="w-[10%] px-4 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" colSpan={6}>
                      <EmptyState
                        action={renderCustomerEmptyAction()}
                        description={
                          allCustomerTotal === 0
                            ? "先维护客户资料，后续新建订单时可直接选择并带出地址和计价方式。"
                            : "调整搜索关键字或快速筛选后再试。"
                        }
                        icon={<UsersRound className="size-4" />}
                        title={
                          allCustomerTotal === 0
                            ? "还没有客户"
                            : "没有符合条件的客户"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="truncate px-4 py-3 font-medium">
                        {customer.customerName}
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 text-muted-foreground tabular-nums">
                        {customer.phone || "-"}
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 text-muted-foreground">
                        {customer.customerAddress || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {customer.defaultPricingTaxIncluded ? "含税" : "不含税"}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <ProcessingFeeSummary customer={customer} />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Tooltip align="end" content="编辑客户" side="top">
                            <Button
                              aria-label="编辑客户"
                              onClick={() => openEditDialog(customer)}
                              size="icon-xs"
                              variant="ghost"
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip align="end" content="删除客户" side="top">
                            <Button
                              aria-label="删除客户"
                              onClick={() => {
                                deleteCustomerMutation.reset();
                                setCustomerToDelete(customer);
                              }}
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
          )}

          {exportCustomersMutation.isError && (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              导出失败：
              {getErrorMessage(exportCustomersMutation.error) ??
                "请稍后重试。"}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <div>
              显示 {customerStart}-{customerEnd} / {customerTotal}
            </div>
            <div className="flex items-center gap-2">
              <span>每页</span>
              <Select
                onValueChange={(value) => {
                  setCustomerPage(1);
                  setCustomerPageSize(Number(value));
                }}
                value={String(customerPageSize)}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {customerPageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={customerPage <= 1}
                onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
                size="icon-sm"
                variant="outline"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <span>
                {customerPage} / {customerPageCount}
              </span>
              <Button
                disabled={customerPage >= customerPageCount}
                onClick={() =>
                  setCustomerPage((page) =>
                    Math.min(customerPageCount, page + 1),
                  )
                }
                size="icon-sm"
                variant="outline"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Dialog onOpenChange={handleFormOpenChange} open={formOpen}>
        <DialogContent className="flex max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-4xl">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={submitCustomer}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle>
                {editingCustomer ? "编辑客户" : "新增客户"}
              </DialogTitle>
              <DialogDescription>
                客户名称为必填；手机仅用于客户档案，加工费用作客户默认报价资料。
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">
                  客户名称<span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    aria-invalid={Boolean(formErrors.customerName)}
                    aria-describedby={
                      formErrors.customerName ? "customer-name-error" : undefined
                    }
                    className={cn(formErrors.customerName && "pr-28")}
                    id="customer-name"
                    value={formValues.customerName}
                    onChange={(event) =>
                      updateFormValue("customerName", event.target.value)
                    }
                  />
                  <InlineInputError
                    id="customer-name-error"
                    message={formErrors.customerName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">手机</Label>
                <div className="relative">
                  <Input
                    aria-invalid={Boolean(formErrors.phone)}
                    aria-describedby={
                      formErrors.phone ? "customer-phone-error" : undefined
                    }
                    className={cn(formErrors.phone && "pr-44")}
                    id="customer-phone"
                    inputMode="tel"
                    value={formValues.phone}
                    onChange={(event) => updatePhoneValue(event.target.value)}
                  />
                  <InlineInputError
                    id="customer-phone-error"
                    message={formErrors.phone}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-address">客户地址</Label>
                <Input
                  id="customer-address"
                  value={formValues.customerAddress}
                  onChange={(event) =>
                    updateFormValue("customerAddress", event.target.value)
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-medium">加工费（含税）</div>
                  {renderProcessingFeeInputs({
                    fields: includedProcessingFeeFields,
                    formErrors,
                    formValues,
                    groupLabel: "含税",
                    updateMoneyValue,
                  })}
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-medium">加工费（不含税）</div>
                  {renderProcessingFeeInputs({
                    fields: excludedProcessingFeeFields,
                    formErrors,
                    formValues,
                    groupLabel: "不含税",
                    updateMoneyValue,
                  })}
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <div className="text-sm font-medium">特殊计价</div>
                  <div className="space-y-2">
                    <Label htmlFor="special-pricing-keyword">订单备注关键词</Label>
                    <Input
                      id="special-pricing-keyword"
                      placeholder="例如：沃德虎标膜"
                      value={formValues.specialPricingKeyword}
                      onChange={(event) =>
                        updateFormValue("specialPricingKeyword", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">特殊价（含税）</div>
                    {renderProcessingFeeInputs({
                      fields: specialIncludedProcessingFeeFields,
                      formErrors,
                      formValues,
                      groupLabel: "特殊含税",
                      updateMoneyValue,
                    })}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">特殊价（不含税）</div>
                    {renderProcessingFeeInputs({
                      fields: specialExcludedProcessingFeeFields,
                      formErrors,
                      formValues,
                      groupLabel: "特殊不含税",
                      updateMoneyValue,
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-pricing-tax-included">
                  默认计价是否含税<span className="text-destructive">*</span>
                </Label>
                <Select
                  disabled={isDefaultPricingSelectDisabled}
                  value={formValues.defaultPricingTaxIncluded}
                  onValueChange={(value) =>
                    updateFormValue(
                      "defaultPricingTaxIncluded",
                      value as CustomerFormValues["defaultPricingTaxIncluded"],
                    )
                  }
                >
                  <SelectTrigger
                    aria-invalid={Boolean(formErrors.defaultPricingTaxIncluded)}
                    id="default-pricing-tax-included"
                  >
                    <SelectValue>
                      {() =>
                        getDefaultPricingLabel(
                          formValues.defaultPricingTaxIncluded,
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      className="data-disabled:opacity-100"
                      disabled={!hasIncludedPrice}
                      value="included"
                    >
                      含税
                      {!hasIncludedPrice && <MissingPriceTag />}
                    </SelectItem>
                    <SelectItem
                      className="data-disabled:opacity-100"
                      disabled={!hasExcludedPrice}
                      value="excluded"
                    >
                      不含税
                      {!hasExcludedPrice && <MissingPriceTag />}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.defaultPricingTaxIncluded && (
                  <div className="text-xs text-destructive">
                    {formErrors.defaultPricingTaxIncluded}
                  </div>
                )}
              </div>

              {writeError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {writeError}
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t pt-4">
              <Button
                disabled={isWriting}
                onClick={() => handleFormOpenChange(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button disabled={isWriting} type="submit">
                {isWriting ? "保存中" : "保存客户"}
              </Button>
            </DialogFooter>
          </form>
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
            <DialogTitle>批量导入客户</DialogTitle>
            <DialogDescription>
              支持 CSV、XLSX、XLS；普通含税/不含税五类加工费为必填列，特殊计价关键词和特殊价列可选。
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
                表头需要包含：客户名称、默认计价、普通五类加工费；特殊价列存在时会一起导入
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
                已解析 {importRows.length} 条客户，预览前{" "}
                {Math.min(importRows.length, 20)} 条
              </div>
            )}

            {importRows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4">客户名称</TableHead>
                      <TableHead className="px-4">手机</TableHead>
                      <TableHead className="px-4">客户地址</TableHead>
                      <TableHead className="px-4">默认计价</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.slice(0, 20).map((customer, index) => (
                      <TableRow key={`${customer.customerName}-${index}`}>
                        <TableCell className="px-4 py-2">
                          {customer.customerName}
                        </TableCell>
                        <TableCell className="px-4 py-2 tabular-nums">
                          {customer.phone || "-"}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {customer.customerAddress || "-"}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {customer.defaultPricingTaxIncluded ? "含税" : "不含税"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {importCustomersMutation.isError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getErrorMessage(importCustomersMutation.error)}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={importCustomersMutation.isPending}
              onClick={resetImportDialog}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={
                importCustomersMutation.isPending ||
                importRows.length === 0 ||
                importErrors.length > 0
              }
              onClick={() => importCustomersMutation.mutate(importRows)}
              type="button"
            >
              {importCustomersMutation.isPending ? "导入中" : "导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setCustomerToDelete(null);
            deleteCustomerMutation.reset();
          }
        }}
        open={Boolean(customerToDelete)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除客户</DialogTitle>
            <DialogDescription>
              删除后该客户不会再出现在新订单和客户商品分配中，且不能直接撤销。有未下订单引用此客户时系统会阻止删除；已下单订单、出库单和价格快照会保留历史凭据。
            </DialogDescription>
          </DialogHeader>

          {customerToDelete && (
            <div className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">{customerToDelete.customerName}</div>
              <div className="text-muted-foreground">
                {customerToDelete.phone || "无手机"} /{" "}
                {customerToDelete.customerAddress || "无地址"}
              </div>
            </div>
          )}

          {deleteCustomerMutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(deleteCustomerMutation.error)}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={deleteCustomerMutation.isPending}
              onClick={() => setCustomerToDelete(null)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={deleteCustomerMutation.isPending || !customerToDelete}
              onClick={() => {
                if (customerToDelete) {
                  deleteCustomerMutation.mutate(customerToDelete.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              {deleteCustomerMutation.isPending ? "删除中" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
