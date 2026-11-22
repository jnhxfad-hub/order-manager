import type { FormEvent, KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  defaultDeliveryNoteFormValues,
  type CustomerInventoryDeliveryFocusRequest,
  type DeliveryNoteFormErrors,
  type DeliveryNoteFormValues,
} from "@/features/inventory/lib/inventory-dialog-state"
import {
  createCustomerInventoryDeliveryWeightRows,
  deliveryWeightFields,
  getRequiredDeliveryWeights,
  type CustomerInventoryDeliveryGroupView,
  type CustomerInventoryDeliveryPriceGroupView,
  type CustomerInventoryDeliveryRow,
} from "@/features/inventory/lib/inventory-utils"
import type { CustomerInventoryBatch } from "@/features/inventory/types"
import { formatCurrencyX100 } from "@/lib/money"
import {
  getProcessingCategoryLabel,
  type ProcessingCategory,
} from "@/lib/processing-fees"
import { cn } from "@/lib/utils"

type DeliveryWeightField = (typeof deliveryWeightFields)[number]

type CustomerInventoryDeliveryDialogProps = {
  canClearCustomerInventoryDeliveryQuantities: boolean
  createErrorMessage?: string | null
  customerInventoryDeliveryErrors: DeliveryNoteFormErrors
  customerInventoryDeliveryFormValues: DeliveryNoteFormValues
  customerInventoryDeliveryGroups: CustomerInventoryDeliveryGroupView[]
  customerInventoryDeliveryOpen: boolean
  customerInventoryDeliveryPriceGroupFormValues: Record<
    string,
    DeliveryNoteFormValues
  >
  customerInventoryDeliveryPriceGroups: CustomerInventoryDeliveryPriceGroupView[]
  customerInventoryDeliveryRows: CustomerInventoryDeliveryRow[]
  customerInventoryDeliveryTotalQuantity: number
  clearAllCustomerInventoryDeliveryQuantities: () => void
  fillAllCustomerInventoryDeliveryQuantities: () => void
  focusNextCustomerInventoryDeliveryTarget: (
    event: KeyboardEvent<HTMLInputElement>,
    request: CustomerInventoryDeliveryFocusRequest,
  ) => void
  handleCustomerInventoryDeliveryOpenChange: (open: boolean) => void
  hasMultipleCustomerInventoryDeliveryPriceGroups: boolean
  isCreateError: boolean
  isCreatePending: boolean
  isWriting: boolean
  onFormValueChange: <Key extends keyof DeliveryNoteFormValues>(
    key: Key,
    value: DeliveryNoteFormValues[Key],
  ) => void
  onGroupLabelChange: (batchId: string, value: string) => void
  onPriceGroupFormValueChange: <Key extends keyof DeliveryNoteFormValues>(
    priceGroupKey: string,
    key: Key,
    value: DeliveryNoteFormValues[Key],
  ) => void
  onRowNoteChange: (stockId: string, value: string) => void
  onRowQuantityChange: (stockId: string, value: string) => void
  requiredCustomerInventoryDeliveryWeights: Record<ProcessingCategory, boolean>
  selectedCustomerInventoryBatch: CustomerInventoryBatch | null
  selectedCustomerInventoryDeliveryBatches: CustomerInventoryBatch[]
  selectedCustomerInventoryPricingProfileName: string
  submitCustomerInventoryDelivery: (event: FormEvent<HTMLFormElement>) => void
  visibleCustomerInventoryDeliveryWeightFields: readonly DeliveryWeightField[]
}

export function CustomerInventoryDeliveryDialog({
  canClearCustomerInventoryDeliveryQuantities,
  createErrorMessage,
  customerInventoryDeliveryErrors,
  customerInventoryDeliveryFormValues,
  customerInventoryDeliveryGroups,
  customerInventoryDeliveryOpen,
  customerInventoryDeliveryPriceGroupFormValues,
  customerInventoryDeliveryPriceGroups,
  customerInventoryDeliveryRows,
  customerInventoryDeliveryTotalQuantity,
  clearAllCustomerInventoryDeliveryQuantities,
  fillAllCustomerInventoryDeliveryQuantities,
  focusNextCustomerInventoryDeliveryTarget,
  handleCustomerInventoryDeliveryOpenChange,
  hasMultipleCustomerInventoryDeliveryPriceGroups,
  isCreateError,
  isCreatePending,
  isWriting,
  onFormValueChange,
  onGroupLabelChange,
  onPriceGroupFormValueChange,
  onRowNoteChange,
  onRowQuantityChange,
  requiredCustomerInventoryDeliveryWeights,
  selectedCustomerInventoryBatch,
  selectedCustomerInventoryDeliveryBatches,
  selectedCustomerInventoryPricingProfileName,
  submitCustomerInventoryDelivery,
  visibleCustomerInventoryDeliveryWeightFields,
}: CustomerInventoryDeliveryDialogProps) {
  return (
      <Dialog
        onOpenChange={handleCustomerInventoryDeliveryOpenChange}
        open={customerInventoryDeliveryOpen}
      >
        <DialogContent className="flex h-[calc(100svh-1rem)] w-[min(1180px,calc(100vw-0.75rem))] max-h-[calc(100svh-1rem)] max-w-[calc(100vw-0.75rem)] flex-col overflow-hidden p-0 sm:max-w-[calc(100vw-0.75rem)]! xl:max-w-[1180px]!">
          <form
            className="flex h-full min-h-0 flex-col"
            onSubmit={submitCustomerInventoryDelivery}
          >
            <DialogHeader className="border-b px-4 py-4">
              <DialogTitle>
                {selectedCustomerInventoryDeliveryBatches.length > 1
                  ? "客户库存合并出库"
                  : "客户库存出库"}
              </DialogTitle>
              <DialogDescription>
                {selectedCustomerInventoryDeliveryBatches.length > 1
                  ? `${selectedCustomerInventoryDeliveryBatches.length} 个批次 · ${
                      selectedCustomerInventoryBatch?.customerName ?? ""
                    }`
                  : `${selectedCustomerInventoryBatch?.id ?? ""} · ${
                      selectedCustomerInventoryBatch?.customerName ?? ""
                    }`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
              {selectedCustomerInventoryBatch && (
                <div className="grid gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm md:grid-cols-6">
                  <div>
                    <span className="text-muted-foreground">批次数</span>
                    <div className="font-semibold tabular-nums">
                      {selectedCustomerInventoryDeliveryBatches.length || 1}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">历史日期</span>
                    <div>{selectedCustomerInventoryBatch.historicalOrderDate || "-"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">计价方案</span>
                    <div className="font-medium">
                      {hasMultipleCustomerInventoryDeliveryPriceGroups
                        ? `${customerInventoryDeliveryPriceGroups.length} 个计价方案`
                        : selectedCustomerInventoryPricingProfileName}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">铝锭价</span>
                    <div>
                      {hasMultipleCustomerInventoryDeliveryPriceGroups
                        ? "按计价方案"
                        : formatCurrencyX100(
                            selectedCustomerInventoryBatch.aluminumIngotPriceX100,
                          )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">计价方式</span>
                    <div>
                      {hasMultipleCustomerInventoryDeliveryPriceGroups
                        ? "按计价方案"
                        : selectedCustomerInventoryBatch.pricingTaxIncluded
                          ? "含税"
                          : "不含税"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">本次出库</span>
                    <div className="font-semibold tabular-nums">
                      {customerInventoryDeliveryTotalQuantity} 支
                    </div>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "grid shrink-0 gap-3",
                  hasMultipleCustomerInventoryDeliveryPriceGroups
                    ? "md:grid-cols-[minmax(14rem,1fr)]"
                    : "md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]",
                )}
              >
                <div className="grid gap-2">
                  <Label htmlFor="customer-inventory-delivery-handler">
                    经手人<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    data-customer-inventory-delivery-field="handler"
                    id="customer-inventory-delivery-handler"
                    aria-invalid={Boolean(
                      customerInventoryDeliveryErrors.handlerName,
                    )}
                    className={cn(
                      customerInventoryDeliveryErrors.handlerName &&
                        "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                    )}
                    onChange={(event) => {
                      onFormValueChange("handlerName", event.target.value)
                    }}
                    onKeyDown={(event) =>
                      focusNextCustomerInventoryDeliveryTarget(event, {
                        kind: "handler",
                      })
                    }
                    placeholder={
                      customerInventoryDeliveryErrors.handlerName ??
                      "请输入经手人"
                    }
                    value={customerInventoryDeliveryFormValues.handlerName}
                  />
                </div>
                {!hasMultipleCustomerInventoryDeliveryPriceGroups && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="customer-inventory-extra-charge-name">
                        收费名称
                      </Label>
                      <Input
                        aria-invalid={Boolean(
                          customerInventoryDeliveryErrors.extraChargeName,
                        )}
                        className={cn(
                          customerInventoryDeliveryErrors.extraChargeName &&
                            "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                        )}
                        data-customer-inventory-delivery-field="extraChargeName"
                        id="customer-inventory-extra-charge-name"
                        onChange={(event) => {
                          onFormValueChange(
                            "extraChargeName",
                            event.target.value,
                          )
                        }}
                        onKeyDown={(event) =>
                          focusNextCustomerInventoryDeliveryTarget(event, {
                            field: "extraChargeName",
                            kind: "extra-charge",
                          })
                        }
                        placeholder={
                          customerInventoryDeliveryErrors.extraChargeName ??
                          "例如：运费、装车费"
                        }
                        value={customerInventoryDeliveryFormValues.extraChargeName}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customer-inventory-extra-charge-amount">
                        收费金额
                      </Label>
                      <Input
                        aria-invalid={Boolean(
                          customerInventoryDeliveryErrors.extraChargeAmount,
                        )}
                        className={cn(
                          customerInventoryDeliveryErrors.extraChargeAmount &&
                            "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                        )}
                        data-customer-inventory-delivery-field="extraChargeAmount"
                        id="customer-inventory-extra-charge-amount"
                        inputMode="decimal"
                        min={0}
                        onChange={(event) => {
                          onFormValueChange(
                            "extraChargeAmount",
                            event.target.value,
                          )
                        }}
                        onKeyDown={(event) =>
                          focusNextCustomerInventoryDeliveryTarget(event, {
                            field: "extraChargeAmount",
                            kind: "extra-charge",
                          })
                        }
                        placeholder={
                          customerInventoryDeliveryErrors.extraChargeAmount ??
                          "例如：200"
                        }
                        step="0.01"
                        type="number"
                        value={customerInventoryDeliveryFormValues.extraChargeAmount}
                      />
                    </div>
                  </>
                )}
              </div>

              {!hasMultipleCustomerInventoryDeliveryPriceGroups &&
                visibleCustomerInventoryDeliveryWeightFields.length > 0 && (
                <div className="grid shrink-0 gap-3 md:grid-cols-5">
                  {visibleCustomerInventoryDeliveryWeightFields.map((field, index) => {
                    const isRequired =
                      requiredCustomerInventoryDeliveryWeights[field.category];

                    return (
                      <div className="space-y-2" key={field.key}>
                        <Label
                          className={cn(
                            !isRequired && "text-muted-foreground",
                          )}
                        >
                          {getProcessingCategoryLabel(field.category)}重量(kg)
                          {isRequired && (
                            <span className="text-destructive">*</span>
                          )}
                        </Label>
                        <Input
                          aria-invalid={Boolean(
                            customerInventoryDeliveryErrors[field.key],
                          )}
                          className={cn(
                            !isRequired && "bg-muted/30 text-muted-foreground",
                            customerInventoryDeliveryErrors[field.key] &&
                              "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                          )}
                          disabled={!isRequired}
                          data-customer-inventory-delivery-field={field.key}
                          inputMode="decimal"
                          onChange={(event) => {
                            onFormValueChange(field.key, event.target.value)
                          }}
                          onKeyDown={(event) =>
                            focusNextCustomerInventoryDeliveryTarget(event, {
                              fieldIndex: index,
                              kind: "weight",
                            })
                          }
                          placeholder={
                            isRequired
                              ? (customerInventoryDeliveryErrors[field.key] ??
                                field.placeholder)
                              : "未出库"
                          }
                          value={
                            isRequired
                              ? customerInventoryDeliveryFormValues[field.key]
                              : ""
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {hasMultipleCustomerInventoryDeliveryPriceGroups && (
                <div className="rounded-md border bg-muted/20">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    计价方案
                  </div>
                  <div className="grid gap-3 p-3">
                    {customerInventoryDeliveryPriceGroups.map((priceGroup, priceGroupIndex) => {
                      const firstBatch = priceGroup.batches[0] ?? null;
                      const formValues =
                        customerInventoryDeliveryPriceGroupFormValues[
                          priceGroup.key
                        ] ?? defaultDeliveryNoteFormValues;
                      const requiredWeights = getRequiredDeliveryWeights(
                        createCustomerInventoryDeliveryWeightRows(
                          priceGroup.rows,
                          "entered",
                        ),
                      );
                      const availableWeights = getRequiredDeliveryWeights(
                        createCustomerInventoryDeliveryWeightRows(
                          priceGroup.rows,
                          "current",
                        ),
                      );
                      const visibleWeightFields = deliveryWeightFields.filter(
                        (field) => availableWeights[field.category],
                      );

                      return (
                        <section
                          className="grid gap-3 rounded-md border bg-background p-3"
                          key={priceGroup.key}
                        >
                          <div className="grid gap-3 text-sm md:grid-cols-5">
                            <div>
                              <span className="text-muted-foreground">
                                {priceGroup.title}
                              </span>
                              <div className="font-medium">
                                {priceGroup.batches.length} 个批次
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                铝锭价
                              </span>
                              <div>
                                {firstBatch
                                  ? formatCurrencyX100(
                                      firstBatch.aluminumIngotPriceX100,
                                    )
                                  : "-"}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                计价方式
                              </span>
                              <div>
                                {firstBatch
                                  ? firstBatch.pricingTaxIncluded
                                    ? "含税"
                                    : "不含税"
                                  : "-"}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                当前库存
                              </span>
                              <div className="tabular-nums">
                                {priceGroup.currentQuantity} 支
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                本次出库
                              </span>
                              <div className="font-semibold tabular-nums">
                                {priceGroup.totalQuantity} 支
                              </div>
                            </div>
                          </div>

                          {visibleWeightFields.length > 0 && (
                            <div className="grid gap-3 md:grid-cols-5">
                              {visibleWeightFields.map((field, fieldIndex) => {
                                const isRequired =
                                  requiredWeights[field.category];
                                const errorKey = `${priceGroup.key}-${field.key}`;

                                return (
                                  <div className="space-y-2" key={field.key}>
                                    <Label
                                      className={cn(
                                        !isRequired && "text-muted-foreground",
                                      )}
                                    >
                                      {getProcessingCategoryLabel(
                                        field.category,
                                      )}
                                      重量(kg)
                                      {isRequired && (
                                        <span className="text-destructive">
                                          *
                                        </span>
                                      )}
                                    </Label>
                                    <Input
                                      aria-invalid={Boolean(
                                        customerInventoryDeliveryErrors[
                                          errorKey
                                        ],
                                      )}
                                      className={cn(
                                        !isRequired &&
                                          "bg-muted/30 text-muted-foreground",
                                        customerInventoryDeliveryErrors[
                                          errorKey
                                        ] &&
                                          "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                                      )}
                                      disabled={!isRequired}
                                      data-customer-inventory-delivery-field={
                                        field.key
                                      }
                                      data-customer-inventory-delivery-price-group={
                                        priceGroup.key
                                      }
                                      inputMode="decimal"
                                      onChange={(event) => {
                                        onPriceGroupFormValueChange(
                                          priceGroup.key,
                                          field.key,
                                          event.target.value,
                                        )
                                      }}
                                      onKeyDown={(event) =>
                                        focusNextCustomerInventoryDeliveryTarget(
                                          event,
                                          {
                                            fieldIndex,
                                            kind: "price-group-weight",
                                            priceGroupIndex,
                                          },
                                        )
                                      }
                                      placeholder={
                                        isRequired
                                          ? (customerInventoryDeliveryErrors[
                                              errorKey
                                            ] ?? field.placeholder)
                                          : "未出库"
                                      }
                                      value={
                                        isRequired
                                          ? formValues[field.key]
                                          : ""
                                      }
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="grid gap-2">
                              <Label>收费名称</Label>
                              <Input
                                aria-invalid={Boolean(
                                  customerInventoryDeliveryErrors[
                                    `${priceGroup.key}-extraChargeName`
                                  ],
                                )}
                                className={cn(
                                  customerInventoryDeliveryErrors[
                                    `${priceGroup.key}-extraChargeName`
                                  ] &&
                                    "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                                )}
                                data-customer-inventory-delivery-field="extraChargeName"
                                data-customer-inventory-delivery-price-group={
                                  priceGroup.key
                                }
                                onChange={(event) => {
                                  onPriceGroupFormValueChange(
                                    priceGroup.key,
                                    "extraChargeName",
                                    event.target.value,
                                  )
                                }}
                                onKeyDown={(event) =>
                                  focusNextCustomerInventoryDeliveryTarget(
                                    event,
                                    {
                                      field: "extraChargeName",
                                      kind: "price-group-extra-charge",
                                      priceGroupIndex,
                                    },
                                  )
                                }
                                placeholder={
                                  customerInventoryDeliveryErrors[
                                    `${priceGroup.key}-extraChargeName`
                                  ] ?? "例如：运费、装车费"
                                }
                                value={formValues.extraChargeName}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>收费金额</Label>
                              <Input
                                aria-invalid={Boolean(
                                  customerInventoryDeliveryErrors[
                                    `${priceGroup.key}-extraChargeAmount`
                                  ],
                                )}
                                className={cn(
                                  customerInventoryDeliveryErrors[
                                    `${priceGroup.key}-extraChargeAmount`
                                  ] &&
                                    "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                                )}
                                data-customer-inventory-delivery-field="extraChargeAmount"
                                data-customer-inventory-delivery-price-group={
                                  priceGroup.key
                                }
                                inputMode="decimal"
                                min={0}
                                onChange={(event) => {
                                  onPriceGroupFormValueChange(
                                    priceGroup.key,
                                    "extraChargeAmount",
                                    event.target.value,
                                  )
                                }}
                                onKeyDown={(event) =>
                                  focusNextCustomerInventoryDeliveryTarget(
                                    event,
                                    {
                                      field: "extraChargeAmount",
                                      kind: "price-group-extra-charge",
                                      priceGroupIndex,
                                    },
                                  )
                                }
                                placeholder={
                                  customerInventoryDeliveryErrors[
                                    `${priceGroup.key}-extraChargeAmount`
                                  ] ?? "例如：200"
                                }
                                step="0.01"
                                type="number"
                                value={formValues.extraChargeAmount}
                              />
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}

              {customerInventoryDeliveryGroups.length > 0 && (
                <div className="rounded-md border bg-muted/20">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    批次分组
                  </div>
                  <div className="grid gap-2 p-3 md:grid-cols-2">
                    {customerInventoryDeliveryGroups.map((group) => {
                      const groupError =
                        customerInventoryDeliveryErrors[
                          `batch-${group.batchId}-groupLabel`
                        ];

                      return (
                        <div
                          className="grid gap-2 rounded-md border bg-background p-3"
                          key={group.batchId}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-medium">
                                {group.batchId}
                              </div>
                              <div
                                className="mt-1 truncate text-xs text-muted-foreground"
                                title={group.batchNote || undefined}
                              >
                                {group.batchNote || "无批次备注"}
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-xs text-muted-foreground">
                              <div>{group.itemCount} 项</div>
                              <div>
                                {group.deliveryQuantity > 0
                                  ? `本次 ${group.deliveryQuantity} 支`
                                  : `库存 ${group.currentQuantity} 支`}
                              </div>
                            </div>
                          </div>
                          <Input
                            aria-invalid={Boolean(groupError)}
                            className={cn(
                              groupError &&
                                "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                            )}
                            data-customer-inventory-delivery-batch={
                              group.batchId
                            }
                            data-customer-inventory-delivery-field="groupLabel"
                            onChange={(event) => {
                              onGroupLabelChange(
                                group.batchId,
                                event.target.value,
                              )
                            }}
                            placeholder={
                              groupError ??
                              (group.defaultGroupLabel
                                ? `默认 ${group.defaultGroupLabel}`
                                : "必填")
                            }
                            value={group.groupLabel}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex min-h-72 shrink-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">出库明细</div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={
                        isWriting || !canClearCustomerInventoryDeliveryQuantities
                      }
                      onClick={clearAllCustomerInventoryDeliveryQuantities}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      清空
                    </Button>
                    <Button
                      disabled={isWriting || customerInventoryDeliveryRows.length === 0}
                      onClick={fillAllCustomerInventoryDeliveryQuantities}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      全部出库
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                  <table className="w-full min-w-260 table-fixed caption-bottom text-sm">
                    <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                      <TableRow>
                        <TableHead className="w-42 px-3">批次</TableHead>
                        <TableHead className="px-3">商品</TableHead>
                        <TableHead className="w-28 px-3">模具编号</TableHead>
                        <TableHead className="w-24 px-3 text-right">
                          长度
                        </TableHead>
                        <TableHead className="w-28 px-3">颜色</TableHead>
                        <TableHead className="w-24 px-3 text-right">
                          当前库存
                        </TableHead>
                        <TableHead className="w-28 px-3 text-right">
                          本次出库
                        </TableHead>
                        <TableHead className="w-[20%] px-3">备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerInventoryDeliveryRows.map((row, index) => (
                        <TableRow key={row.stockId}>
                          <TableCell className="px-3 py-2 font-mono text-xs">
                            {row.batchId}
                          </TableCell>
                          <TableCell className="truncate px-3 py-2 font-medium">
                            {row.productName}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-mono text-sm">
                            {row.moldCode}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums">
                            {row.lengthMm}
                          </TableCell>
                          <TableCell className="truncate px-3 py-2 text-muted-foreground">
                            {row.color}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right tabular-nums">
                            {row.currentQuantity}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Input
                              aria-invalid={Boolean(
                                customerInventoryDeliveryErrors[row.stockId],
                              )}
                              className={cn(
                                "text-right",
                                customerInventoryDeliveryErrors[row.stockId] &&
                                  "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive/30",
                              )}
                              data-customer-inventory-delivery-field="quantity"
                              data-customer-inventory-delivery-row={index}
                              inputMode="numeric"
                              onChange={(event) => {
                                onRowQuantityChange(
                                  row.stockId,
                                  event.target.value,
                                )
                              }}
                              onKeyDown={(event) =>
                                focusNextCustomerInventoryDeliveryTarget(event, {
                                  field: "quantity",
                                  kind: "row",
                                  rowIndex: index,
                                })
                              }
                              placeholder={
                                customerInventoryDeliveryErrors[row.stockId] ??
                                `最多 ${row.currentQuantity}`
                              }
                              value={row.quantity}
                            />
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Input
                              data-customer-inventory-delivery-field="note"
                              data-customer-inventory-delivery-row={index}
                              onChange={(event) =>
                                onRowNoteChange(
                                  row.stockId,
                                  event.target.value,
                                )
                              }
                              onKeyDown={(event) =>
                                focusNextCustomerInventoryDeliveryTarget(event, {
                                  field: "note",
                                  kind: "row",
                                  rowIndex: index,
                                })
                              }
                              value={row.note}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
              </div>

              <Input
                data-customer-inventory-delivery-field="delivery-note"
                onChange={(event) =>
                  onFormValueChange("note", event.target.value)
                }
                placeholder="出库单备注"
                value={customerInventoryDeliveryFormValues.note}
              />

              <div className="grid gap-2">
                <Label htmlFor="customer-inventory-delivery-special-note">
                  特殊提示
                </Label>
                <Input
                  id="customer-inventory-delivery-special-note"
                  onChange={(event) =>
                    onFormValueChange("specialNote", event.target.value)
                  }
                  placeholder="仅特殊订单填写，打印时醒目显示在备注下方"
                  value={customerInventoryDeliveryFormValues.specialNote}
                />
              </div>

              {customerInventoryDeliveryErrors.form && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {customerInventoryDeliveryErrors.form}
                </div>
              )}
              {isCreateError && createErrorMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {createErrorMessage}
                </div>
              )}
            </div>

            <DialogFooter className="m-0 rounded-none">
              <Button
                disabled={isWriting}
                onClick={() => handleCustomerInventoryDeliveryOpenChange(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button disabled={isWriting} type="submit">
                {isCreatePending
                  ? "出库中"
                  : "确认出库并预览"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  )
}
