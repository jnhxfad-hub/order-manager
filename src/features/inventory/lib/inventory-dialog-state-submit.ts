import {
  createCustomerInventoryDeliveryWeightRows,
  getInventoryDetailKey,
  getRequiredDeliveryWeights,
  parseWeightKgToX100,
  type CustomerInventoryBatchRow,
  type CustomerInventoryDeliveryPriceGroupView,
  type CustomerInventoryDeliveryRow,
  type DeliveryNoteFocusTarget,
  type DeliveryNoteFormRow,
} from "@/features/inventory/lib/inventory-utils"
import type { CustomerInventoryBatch } from "@/features/inventory/types"
import { parseMoneyToX100 } from "@/lib/money"
import { parseIntegerInput } from "@/lib/number-input"
import {
  getProcessingCategoryConflict,
  getProcessingCategoryLabel,
  type ProcessingCategory,
} from "@/lib/processing-fees"
import {
  defaultDeliveryNoteFormValues,
  normalizeCustomerInventoryHistoricalOrderDate,
  parseDeliveryExtraCharge,
  parseDeliveryExtraCharges,
} from "./inventory-dialog-state-forms"
import type {
  CustomerInventoryBatchErrors,
  CustomerInventoryBatchFormValues,
  CustomerInventoryBatchMoneyKey,
  CustomerInventoryBatchSubmitState,
  CustomerInventoryDeliverySubmitState,
  DeliveryNoteFormErrors,
  DeliveryNoteFormValues,
  DeliveryNoteSubmitState,
} from "./inventory-dialog-state-types"

export function collectDeliveryNoteSubmitState({
  orderId,
  requiredWeights,
  rows,
  values,
}: {
  orderId: string
  requiredWeights: ReturnType<typeof getRequiredDeliveryWeights>
  rows: DeliveryNoteFormRow[]
  values: DeliveryNoteFormValues
}): DeliveryNoteSubmitState {
  const errors: DeliveryNoteFormErrors = {}
  const bridgeWeightKgX100 = parseWeightKgToX100(values.bridgeWeightKg)
  const powderWeightKgX100 = parseWeightKgToX100(values.powderWeightKg)
  const billetWeightKgX100 = parseWeightKgToX100(values.billetWeightKg)
  const oxidationWeightKgX100 = parseWeightKgToX100(values.oxidationWeightKg)
  const electrophoresisWeightKgX100 = parseWeightKgToX100(
    values.electrophoresisWeightKg,
  )
  const extraCharge = parseDeliveryExtraCharges(values)

  if (bridgeWeightKgX100 === null) {
    errors.bridgeWeightKg = "断桥重量不能小于 0"
  }

  if (
    bridgeWeightKgX100 !== null &&
    requiredWeights.bridge &&
    bridgeWeightKgX100 <= 0
  ) {
    errors.bridgeWeightKg = "请填写断桥重量"
  }

  if (powderWeightKgX100 === null) {
    errors.powderWeightKg = "喷涂重量不能小于 0"
  }

  if (
    powderWeightKgX100 !== null &&
    requiredWeights.powder &&
    powderWeightKgX100 <= 0
  ) {
    errors.powderWeightKg = "请填写喷涂重量"
  }

  if (billetWeightKgX100 === null) {
    errors.billetWeightKg = "坯料重量不能小于 0"
  }

  if (
    billetWeightKgX100 !== null &&
    requiredWeights.billet &&
    billetWeightKgX100 <= 0
  ) {
    errors.billetWeightKg = "请填写坯料重量"
  }

  if (oxidationWeightKgX100 === null) {
    errors.oxidationWeightKg = "氧化重量不能小于 0"
  }

  if (
    oxidationWeightKgX100 !== null &&
    requiredWeights.oxidation &&
    oxidationWeightKgX100 <= 0
  ) {
    errors.oxidationWeightKg = "请填写氧化重量"
  }

  if (electrophoresisWeightKgX100 === null) {
    errors.electrophoresisWeightKg = "电泳重量不能小于 0"
  }

  if (
    electrophoresisWeightKgX100 !== null &&
    requiredWeights.electrophoresis &&
    electrophoresisWeightKgX100 <= 0
  ) {
    errors.electrophoresisWeightKg = "请填写电泳重量"
  }

  Object.assign(errors, extraCharge.errors)

  const items = rows.map((row) => {
    const detailKey = getInventoryDetailKey(row)
    const rawQuantity = row.quantity.trim()

    if (!rawQuantity) {
      return {
        color: row.color,
        lengthMm: row.lengthMm,
        note: row.note.trim(),
        productId: row.productId,
        quantity: 0,
      }
    }

    const quantity = parseIntegerInput(rawQuantity)
    const colorConflict = getProcessingCategoryConflict(row.color)

    if (quantity === null) {
      errors[detailKey] = "数量不能小于 0"
      return {
        color: row.color,
        lengthMm: row.lengthMm,
        note: row.note.trim(),
        productId: row.productId,
        quantity: 0,
      }
    }

    if (quantity > row.currentQuantity) {
      errors[detailKey] = "出库数量不能大于当前库存"
    }

    if (quantity > 0 && colorConflict) {
      errors[detailKey] = colorConflict
    }

    return {
      color: row.color,
      lengthMm: row.lengthMm,
      note: row.note.trim(),
      productId: row.productId,
      quantity,
    }
  })

  if (!items.some((item) => item.quantity > 0)) {
    errors.form = "请至少录入一项出库数量"
  }

  if (Object.keys(errors).length > 0 || extraCharge.amountX100 === null) {
    return { errors, payload: null }
  }

  return {
    errors,
    payload: {
      billetWeightKgX100: billetWeightKgX100 ?? 0,
      bridgeWeightKgX100: bridgeWeightKgX100 ?? 0,
      electrophoresisWeightKgX100: electrophoresisWeightKgX100 ?? 0,
      extraCharges: extraCharge.charges,
      items,
      note: values.note.trim(),
      orderId,
      oxidationWeightKgX100: oxidationWeightKgX100 ?? 0,
      powderWeightKgX100: powderWeightKgX100 ?? 0,
      pricingTaxIncluded: values.pricingTaxIncluded,
      specialNote: (values.specialNote ?? "").trim(),
    },
  }
}

export function getFirstInvalidDeliveryNoteFocusTarget({
  errors,
  requiredWeights,
  rows,
  values,
}: {
  errors: DeliveryNoteFormErrors
  requiredWeights: ReturnType<typeof getRequiredDeliveryWeights>
  rows: DeliveryNoteFormRow[]
  values: DeliveryNoteFormValues
}): DeliveryNoteFocusTarget | null {
  if (errors.bridgeWeightKg) {
    return { kind: "field", field: "bridgeWeightKg" }
  }

  if (errors.powderWeightKg) {
    return { kind: "field", field: "powderWeightKg" }
  }

  if (errors.billetWeightKg) {
    return { kind: "field", field: "billetWeightKg" }
  }

  if (errors.oxidationWeightKg) {
    return { kind: "field", field: "oxidationWeightKg" }
  }

  if (errors.electrophoresisWeightKg) {
    return { kind: "field", field: "electrophoresisWeightKg" }
  }

  const chargeError = Object.keys(errors).find(
    (key) => /^extraCharge(Name|Amount)-\d+$/.test(key) && errors[key],
  )
  if (chargeError) {
    return {
      kind: "field",
      field: chargeError as `extraChargeName-${number}` | `extraChargeAmount-${number}`,
    }
  }

  if (errors.extraChargeName) {
    return { kind: "field", field: "extraChargeName" }
  }

  if (errors.extraChargeAmount) {
    return { kind: "field", field: "extraChargeAmount" }
  }

  for (const row of rows) {
    const detailKey = getInventoryDetailKey(row)

    if (errors[detailKey]) {
      return { kind: "row", detailKey, field: "quantity" }
    }
  }

  if (errors.form && rows.length > 0) {
    return {
      kind: "row",
      detailKey: getInventoryDetailKey(rows[0]),
      field: "quantity",
    }
  }

  const bridgeWeightKgX100 = parseWeightKgToX100(values.bridgeWeightKg)
  const powderWeightKgX100 = parseWeightKgToX100(values.powderWeightKg)
  const billetWeightKgX100 = parseWeightKgToX100(values.billetWeightKg)
  const oxidationWeightKgX100 = parseWeightKgToX100(values.oxidationWeightKg)
  const electrophoresisWeightKgX100 = parseWeightKgToX100(
    values.electrophoresisWeightKg,
  )

  if (
    requiredWeights.bridge &&
    (bridgeWeightKgX100 === null || bridgeWeightKgX100 <= 0)
  ) {
    return { kind: "field", field: "bridgeWeightKg" }
  }

  if (
    requiredWeights.powder &&
    (powderWeightKgX100 === null || powderWeightKgX100 <= 0)
  ) {
    return { kind: "field", field: "powderWeightKg" }
  }

  if (
    requiredWeights.billet &&
    (billetWeightKgX100 === null || billetWeightKgX100 <= 0)
  ) {
    return { kind: "field", field: "billetWeightKg" }
  }

  if (
    requiredWeights.oxidation &&
    (oxidationWeightKgX100 === null || oxidationWeightKgX100 <= 0)
  ) {
    return { kind: "field", field: "oxidationWeightKg" }
  }

  if (
    requiredWeights.electrophoresis &&
    (electrophoresisWeightKgX100 === null || electrophoresisWeightKgX100 <= 0)
  ) {
    return { kind: "field", field: "electrophoresisWeightKg" }
  }

  return null
}

export function collectCustomerInventoryDeliverySubmitState({
  defaultGroupLabel,
  formValues,
  hasMultiplePriceGroups,
  priceGroupFormValues,
  priceGroups,
  rows,
  selectedBatch,
}: {
  defaultGroupLabel: (batchNote: string) => string
  formValues: DeliveryNoteFormValues
  hasMultiplePriceGroups: boolean
  priceGroupFormValues: Record<string, DeliveryNoteFormValues>
  priceGroups: CustomerInventoryDeliveryPriceGroupView[]
  rows: CustomerInventoryDeliveryRow[]
  selectedBatch?: CustomerInventoryBatch | null
}): CustomerInventoryDeliverySubmitState {
  const errors: DeliveryNoteFormErrors = {}
  const handlerName = formValues.handlerName.trim()

  if (selectedBatch === null) {
    errors.form = "请选择客户库存批次"
    return { errors, payloads: [] }
  }

  if (!handlerName) {
    errors.handlerName = "请输入经手人"
  }

  const items = rows.flatMap((row) => {
    const quantity = parseIntegerInput(row.quantity)

    if (!row.quantity.trim()) {
      return []
    }

    if (quantity === null || quantity <= 0) {
      errors[row.stockId] = "数量必须大于 0"
      return []
    }

    if (quantity > row.currentQuantity) {
      errors[row.stockId] = "出库数量不能大于当前库存"
      return []
    }

    const colorConflict = getProcessingCategoryConflict(row.color)
    if (colorConflict) {
      errors[row.stockId] = colorConflict
      return []
    }

    const groupLabel = row.groupLabel.trim() || defaultGroupLabel(row.batchNote)

    if (!groupLabel) {
      errors[`batch-${row.batchId}-groupLabel`] = "请输入分组"
      return []
    }

    return [
      {
        groupLabel,
        note: row.note.trim(),
        quantity,
        stockId: row.stockId,
      },
    ]
  })

  if (items.length === 0) {
    errors.form = "请至少录入一项出库数量"
  }

  const itemStockIds = new Set(items.map((item) => item.stockId))
  const priceGroupPayloads = priceGroups.flatMap((priceGroup) => {
    const groupRows = priceGroup.rows.filter((row) =>
      itemStockIds.has(row.stockId),
    )
    const groupItems = items.filter((item) =>
      groupRows.some((row) => row.stockId === item.stockId),
    )

    if (groupItems.length === 0) {
      return []
    }

    const values = hasMultiplePriceGroups
      ? (priceGroupFormValues[priceGroup.key] ?? defaultDeliveryNoteFormValues)
      : formValues
    const errorPrefix = hasMultiplePriceGroups ? `${priceGroup.key}-` : ""
    const requiredWeights = getRequiredDeliveryWeights(
      createCustomerInventoryDeliveryWeightRows(groupRows, "entered"),
    )
    const bridgeWeightKgX100 = parseWeightKgToX100(values.bridgeWeightKg)
    const powderWeightKgX100 = parseWeightKgToX100(values.powderWeightKg)
    const billetWeightKgX100 = parseWeightKgToX100(values.billetWeightKg)
    const oxidationWeightKgX100 = parseWeightKgToX100(values.oxidationWeightKg)
    const electrophoresisWeightKgX100 = parseWeightKgToX100(
      values.electrophoresisWeightKg,
    )
    const extraCharge = parseDeliveryExtraCharge(values)

    if (
      requiredWeights.bridge &&
      (bridgeWeightKgX100 === null || bridgeWeightKgX100 <= 0)
    ) {
      errors[`${errorPrefix}bridgeWeightKg`] = "请填写断桥重量"
    }

    if (
      requiredWeights.powder &&
      (powderWeightKgX100 === null || powderWeightKgX100 <= 0)
    ) {
      errors[`${errorPrefix}powderWeightKg`] = "请填写喷涂重量"
    }

    if (
      requiredWeights.billet &&
      (billetWeightKgX100 === null || billetWeightKgX100 <= 0)
    ) {
      errors[`${errorPrefix}billetWeightKg`] = "请填写坯料重量"
    }

    if (
      requiredWeights.oxidation &&
      (oxidationWeightKgX100 === null || oxidationWeightKgX100 <= 0)
    ) {
      errors[`${errorPrefix}oxidationWeightKg`] = "请填写氧化重量"
    }

    if (
      requiredWeights.electrophoresis &&
      (electrophoresisWeightKgX100 === null ||
        electrophoresisWeightKgX100 <= 0)
    ) {
      errors[`${errorPrefix}electrophoresisWeightKg`] = "请填写电泳重量"
    }

    for (const [key, message] of Object.entries(extraCharge.errors)) {
      errors[`${errorPrefix}${key}`] = message
    }

    if (
      bridgeWeightKgX100 === null ||
      powderWeightKgX100 === null ||
      billetWeightKgX100 === null ||
      oxidationWeightKgX100 === null ||
      electrophoresisWeightKgX100 === null ||
      extraCharge.amountX100 === null
    ) {
      return []
    }

    return [
      {
        batchIds: priceGroup.batchIds,
        billetWeightKgX100,
        bridgeWeightKgX100,
        electrophoresisWeightKgX100,
        extraChargeAmountX100: extraCharge.amountX100,
        extraChargeName: extraCharge.name,
        items: groupItems,
        oxidationWeightKgX100,
        powderWeightKgX100,
      },
    ]
  })

  if (Object.keys(errors).length > 0 || priceGroupPayloads.length === 0) {
    return { errors, payloads: [] }
  }

  const batchIds = Array.from(
    new Set(priceGroupPayloads.flatMap((priceGroup) => priceGroup.batchIds)),
  )
  const firstPriceGroup = priceGroupPayloads[0]

  if (!firstPriceGroup) {
    return { errors, payloads: [] }
  }

  return {
    errors,
    payloads: [
      {
        batchId: batchIds[0],
        batchIds,
        billetWeightKgX100: firstPriceGroup.billetWeightKgX100,
        bridgeWeightKgX100: firstPriceGroup.bridgeWeightKgX100,
        electrophoresisWeightKgX100:
          firstPriceGroup.electrophoresisWeightKgX100,
        extraChargeAmountX100: firstPriceGroup.extraChargeAmountX100,
        extraChargeName: firstPriceGroup.extraChargeName,
        handlerName,
        items,
        note: formValues.note.trim(),
        oxidationWeightKgX100: firstPriceGroup.oxidationWeightKgX100,
        powderWeightKgX100: firstPriceGroup.powderWeightKgX100,
        priceGroups: priceGroupPayloads,
        specialNote: (formValues.specialNote ?? "").trim(),
      },
    ],
  }
}

function parseCustomerInventoryMoneyField(
  value: string,
  label: string,
  errors: CustomerInventoryBatchErrors,
  key: CustomerInventoryBatchMoneyKey,
) {
  const parsed = parseMoneyToX100(value)

  if (parsed === null) {
    errors[key] = `${label}只能输入数字`
    return null
  }

  return parsed
}

export function collectCustomerInventoryBatchSubmitState({
  requiredCategories,
  rows,
  values,
}: {
  requiredCategories: ProcessingCategory[]
  rows: CustomerInventoryBatchRow[]
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchSubmitState {
  const errors: CustomerInventoryBatchErrors = {}
  const historicalOrderDate = normalizeCustomerInventoryHistoricalOrderDate(
    values.historicalOrderDate,
  )
  const aluminumIngotPriceX100 = parseCustomerInventoryMoneyField(
    values.aluminumIngotPrice,
    "铝锭价",
    errors,
    "aluminumIngotPrice",
  )
  const bridgeProcessingFeeX100 = parseCustomerInventoryMoneyField(
    values.bridgeProcessingFee,
    "断桥加工费",
    errors,
    "bridgeProcessingFee",
  )
  const powderProcessingFeeX100 = parseCustomerInventoryMoneyField(
    values.powderProcessingFee,
    "喷涂加工费",
    errors,
    "powderProcessingFee",
  )
  const billetProcessingFeeX100 = parseCustomerInventoryMoneyField(
    values.billetProcessingFee,
    "坯料加工费",
    errors,
    "billetProcessingFee",
  )
  const oxidationProcessingFeeX100 = parseCustomerInventoryMoneyField(
    values.oxidationProcessingFee,
    "氧化加工费",
    errors,
    "oxidationProcessingFee",
  )
  const electrophoresisProcessingFeeX100 = parseCustomerInventoryMoneyField(
    values.electrophoresisProcessingFee,
    "电泳加工费",
    errors,
    "electrophoresisProcessingFee",
  )

  if (!values.customerId) {
    errors.customerId = "请选择客户"
  }

  if (historicalOrderDate.error) {
    errors.historicalOrderDate = historicalOrderDate.error
  }

  if (aluminumIngotPriceX100 !== null && aluminumIngotPriceX100 <= 0) {
    errors.aluminumIngotPrice = "铝锭价必须大于 0"
  }

  const items = rows.flatMap((row, index) => {
    const rowKey = `row-${index}`
    const lengthMm = parseIntegerInput(row.lengthMm)
    const quantity = parseIntegerInput(row.quantity)

    if (
      !row.productId &&
      !row.lengthMm.trim() &&
      !row.color.trim() &&
      !row.quantity.trim()
    ) {
      return []
    }

    if (!row.productId) {
      errors[`${rowKey}-productId`] = "请选择商品"
    }

    if (lengthMm === null || lengthMm <= 0) {
      errors[`${rowKey}-lengthMm`] = "长度必须大于 0"
    }

    if (!row.color.trim()) {
      errors[`${rowKey}-color`] = "请输入颜色"
    }

    if (quantity === null || quantity <= 0) {
      errors[`${rowKey}-quantity`] = "数量必须大于 0"
    }

    if (!row.productId || lengthMm === null || quantity === null) {
      return []
    }

    return [
      {
        color: row.color.trim(),
        lengthMm,
        note: row.note.trim(),
        productId: row.productId,
        quantity,
      },
    ]
  })

  const processingFees = {
    billet: {
      key: "billetProcessingFee",
      value: billetProcessingFeeX100,
    },
    bridge: {
      key: "bridgeProcessingFee",
      value: bridgeProcessingFeeX100,
    },
    electrophoresis: {
      key: "electrophoresisProcessingFee",
      value: electrophoresisProcessingFeeX100,
    },
    oxidation: {
      key: "oxidationProcessingFee",
      value: oxidationProcessingFeeX100,
    },
    powder: {
      key: "powderProcessingFee",
      value: powderProcessingFeeX100,
    },
  } satisfies Record<
    ProcessingCategory,
    { key: CustomerInventoryBatchMoneyKey; value: number | null }
  >

  for (const category of requiredCategories) {
    const fee = processingFees[category]

    if (fee.value !== null && fee.value <= 0) {
      errors[fee.key] = `请填写${getProcessingCategoryLabel(category)}加工费`
    }
  }

  if (items.length === 0) {
    errors.form = "请至少添加一项客户库存"
  }

  if (
    Object.keys(errors).length > 0 ||
    aluminumIngotPriceX100 === null ||
    bridgeProcessingFeeX100 === null ||
    powderProcessingFeeX100 === null ||
    billetProcessingFeeX100 === null ||
    oxidationProcessingFeeX100 === null ||
    electrophoresisProcessingFeeX100 === null
  ) {
    return { errors, payload: null }
  }

  return {
    errors,
    payload: {
      aluminumIngotPriceX100,
      billetProcessingFeeX100,
      bridgeProcessingFeeX100,
      customerId: values.customerId,
      electrophoresisProcessingFeeX100,
      historicalOrderDate: historicalOrderDate.value,
      historicalOrderRef: values.historicalOrderRef.trim(),
      items,
      note: values.note.trim(),
      oxidationProcessingFeeX100,
      powderProcessingFeeX100,
      pricingTaxIncluded: values.pricingTaxIncluded,
    },
  }
}
