import type {
  CustomerInventoryBatch,
  DeliveryNote,
  InventoryMovementType,
  MergedDeliveryNote,
  MergedDeliveryNoteItem,
  MergedDeliveryNotePriceGroup,
  OrderInventoryItem,
  RecognizedInventoryImageItem,
} from "@/features/inventory/types"
import type {
  AdjustInventoryPayload,
  AdjustOrderInventoryBatchPayload,
  AdjustOrderInventoryPayload,
  TransferPublicInventoryToOrderPayload,
} from "@/features/inventory/api/inventory-api"
import { formatCompactDatePart, formatDateInputValue } from "@/lib/datetime"
import { parseIntegerInput } from "@/lib/number-input"
import {
  getProcessingCategoryFromColor,
  getProcessingCategoryQuantityItems,
} from "@/lib/processing-fees"

export type InventoryNotice = {
  message: string
  tone: "success" | "warning" | "info"
}

export type BatchOrderInventoryRow = {
  productId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  requiredQuantity: number
  currentQuantity: number
  quantity: string
}

export type BatchOrderImageRecognitionStatus =
  | "matched"
  | "unmatched"
  | "ambiguous"

export type BatchOrderImageRecognitionMatch = {
  item: RecognizedInventoryImageItem
  status: BatchOrderImageRecognitionStatus
  message: string
  detailKey?: string
  candidates?: BatchOrderInventoryRow[]
}

export type BatchOrderImageRecognitionResult = {
  paths: string[]
  matches: BatchOrderImageRecognitionMatch[]
  rawTexts: string[]
  skippedPaths: string[]
  failedImages: string[]
}

export type BatchOrderImageRecognitionRequest = {
  images: BatchOrderImagePreview[]
  skippedPaths: string[]
}

export type BatchOrderImagePreview = {
  path: string
  previewUrl: string
  rotationDegrees: number
}

const BATCH_ORDER_IMAGE_LENGTH_SNAP_TOLERANCE_MM = 10

export type DeliveryNoteWeightKey =
  | "bridgeWeightKg"
  | "powderWeightKg"
  | "billetWeightKg"
  | "oxidationWeightKg"
  | "electrophoresisWeightKg"

export type DeliveryNoteFieldKey =
  | DeliveryNoteWeightKey
  | "extraChargeAmount"
  | "extraChargeName"
  | `extraChargeName-${number}`
  | `extraChargeAmount-${number}`
  | "note"

export type DeliveryNoteFocusTarget =
  | { kind: "field"; field: DeliveryNoteFieldKey }
  | { kind: "row"; detailKey: string; field: "quantity" | "note" }

export type DeliveryNoteFormRow = {
  productId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  requiredQuantity: number
  currentQuantity: number
  quantity: string
  note: string
}

export type CustomerInventoryDeliveryRow = {
  batchId: string
  batchNote: string
  stockId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  currentQuantity: number
  quantity: string
  groupLabel: string
  note: string
}

export type CustomerInventoryBatchRow = {
  productId: string
  productName: string
  moldCode: string
  thicknessMmX100: number
  weightPerMeterKgX1000: number
  lengthMm: string
  color: string
  quantity: string
  note: string
}

export type CustomerInventoryDeliveryPriceGroupSource = {
  batchIds: string[]
  key: string
}

export type CustomerInventoryDeliveryPriceGroupView = {
  batchIds: string[]
  batches: CustomerInventoryBatch[]
  currentQuantity: number
  key: string
  rows: CustomerInventoryDeliveryRow[]
  title: string
  totalQuantity: number
}

export type CustomerInventoryDeliveryGroupView = {
  batchId: string
  batchNote: string
  currentQuantity: number
  defaultGroupLabel: string
  deliveryQuantity: number
  groupLabel: string
  itemCount: number
}

export type OrderInventoryFilter =
  | "all"
  | "pending"
  | "stocked"
  | "delivered"
  | "overstock"

export type OrderInventoryGroup = {
  orderId: string
  customerName: string
  customerAddress: string
  handlerName: string
  pricingTaxIncluded: boolean
  deliveryNoteId: string | null
  deliveryNoteIds: string[]
  inventoryLockedAt: string | null
  inventoryClosedAt: string | null
  inventoryCloseDestination: "shipped" | "public" | "customer" | null
  orderedDate: string | null
  orderNote: string
  items: OrderInventoryItem[]
}

export type InventoryOverviewStats = {
  customerInventoryBatchCount: number
  customerInventoryTotalStockQuantity: number
  inventoryOverviewTotalQuantity: number
  orderInventoryOrderCount: number
  orderInventoryTotalQuantity: number
  publicInventoryItemCount: number
  publicInventoryTotalQuantity: number
}

export type CustomerInventoryDeliveryCreateResult = {
  currentDeliveryNote: DeliveryNote | null
  currentMergedDeliveryNote: MergedDeliveryNote | null
  message: string
}

export type DeliveryNotePrintPreviewState = {
  currentDeliveryNote: DeliveryNote | null
  currentMergedDeliveryNote: MergedDeliveryNote | null
}

export type MergedDeliveryNoteBuildOptions = {
  customGroupsByDeliveryNoteId?: Record<string, string>
  deliveryDate: string
  groupColumnLabel?: string
  id: string
  notes: DeliveryNote[]
  note?: string
  specialNote?: string
}

export type MergedDeliveryNotePreviewOptions = {
  customGroupsByDeliveryNoteId?: Record<string, string>
  notes: DeliveryNote[]
  now?: Date
  specialNote?: string
}

export type MergedDeliveryNotePreviewResult = {
  errorMessage: string | null
  mergedDeliveryNote: MergedDeliveryNote | null
}

export type MergedDeliveryNotePrintRow = MergedDeliveryNoteItem & {
  customGroupRowSpan: number
  showCustomGroup: boolean
}

export type InventoryView = "stock" | "orders" | "customer" | "movements"

export const movementText: Record<InventoryMovementType, string> = {
  adjust: "调整",
  in: "入库",
  out: "出库",
  produce: "订单入库",
  ship: "订单出库",
  transfer_customer: "转客户库存",
  transfer_public: "转公共库存",
}

export const inventoryViews: Array<{ label: string; value: InventoryView }> = [
  { label: "订单库存", value: "orders" },
  { label: "客户库存", value: "customer" },
  { label: "公共库存", value: "stock" },
  { label: "库存流水", value: "movements" },
]

export const orderInventoryFilters: Array<{
  label: string
  value: OrderInventoryFilter
}> = [
  { label: "全部", value: "all" },
  { label: "待入库", value: "pending" },
  { label: "有库存", value: "stocked" },
  { label: "已出库", value: "delivered" },
  { label: "超入库", value: "overstock" },
]

export const deliveryWeightFields = [
  { category: "bridge", key: "bridgeWeightKg", placeholder: "例如：120.50" },
  { category: "powder", key: "powderWeightKg", placeholder: "例如：80.00" },
  { category: "billet", key: "billetWeightKg", placeholder: "例如：40.00" },
  { category: "oxidation", key: "oxidationWeightKg", placeholder: "例如：60.00" },
  {
    category: "electrophoresis",
    key: "electrophoresisWeightKg",
    placeholder: "例如：60.00",
  },
] satisfies Array<{
  category: "bridge" | "powder" | "billet" | "oxidation" | "electrophoresis"
  key: DeliveryNoteWeightKey
  placeholder: string
}>

export function createCustomerInventoryDeliveryWeightRows(
  rows: CustomerInventoryDeliveryRow[],
  quantityMode: "entered" | "current",
): DeliveryNoteFormRow[] {
  return rows.map((row) => ({
    color: row.color,
    currentQuantity: row.currentQuantity,
    lengthMm: row.lengthMm,
    moldCode: row.moldCode,
    note: row.note,
    productId: "",
    productName: row.productName,
    quantity:
      quantityMode === "current" ? String(row.currentQuantity) : row.quantity,
    requiredQuantity: row.currentQuantity,
  }))
}

export function getCustomerInventoryBatchRequiredCategories(
  rows: CustomerInventoryBatchRow[],
) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.color.trim())
        .filter(Boolean)
        .map((color) => getProcessingCategoryFromColor(color)),
    ),
  )
}

export function getCustomerInventoryBatchTotalQuantity(
  rows: CustomerInventoryBatchRow[],
) {
  return rows.reduce((total, row) => {
    const quantity = parseIntegerInput(row.quantity)

    return total + (quantity !== null && quantity > 0 ? quantity : 0)
  }, 0)
}

export function getCustomerInventoryBatchCategoryQuantityItems(
  rows: CustomerInventoryBatchRow[],
) {
  return getProcessingCategoryQuantityItems(
    rows.flatMap((row) => {
      const quantity = parseIntegerInput(row.quantity)

      if (quantity === null) {
        return []
      }

      return [{ color: row.color, quantity }]
    }),
  )
}

export function getCustomerInventoryBatchRowWeightX100(
  row: CustomerInventoryBatchRow,
) {
  const lengthMm = parseIntegerInput(row.lengthMm)
  const quantity = parseIntegerInput(row.quantity)

  if (
    lengthMm === null ||
    quantity === null ||
    lengthMm <= 0 ||
    quantity <= 0 ||
    row.weightPerMeterKgX1000 <= 0
  ) {
    return 0
  }

  return Math.round(
    (lengthMm / 1000) * quantity * (row.weightPerMeterKgX1000 / 10),
  )
}

export function getCustomerInventoryBatchTotalTheoreticalWeightX100(
  rows: CustomerInventoryBatchRow[],
) {
  return rows.reduce(
    (total, row) => total + getCustomerInventoryBatchRowWeightX100(row),
    0,
  )
}

export function getRequiredCustomerInventoryDeliveryPriceGroupWeightFields(
  priceGroup: CustomerInventoryDeliveryPriceGroupView,
) {
  const requiredWeights = getRequiredDeliveryWeights(
    createCustomerInventoryDeliveryWeightRows(priceGroup.rows, "entered"),
  )
  const availableWeights = getRequiredDeliveryWeights(
    createCustomerInventoryDeliveryWeightRows(priceGroup.rows, "current"),
  )

  return deliveryWeightFields.filter(
    (field) =>
      availableWeights[field.category] && requiredWeights[field.category],
  )
}

export function getCustomerInventoryDeliveryTotalQuantity(
  rows: CustomerInventoryDeliveryRow[],
) {
  return rows.reduce((total, row) => {
    const quantity = parseIntegerInput(row.quantity)
    return quantity !== null && quantity > 0 ? total + quantity : total
  }, 0)
}

export function buildCustomerInventoryDeliveryPriceGroups(
  batches: CustomerInventoryBatch[],
  rows: CustomerInventoryDeliveryRow[],
  priceGroups: CustomerInventoryDeliveryPriceGroupSource[],
) {
  return priceGroups.map((group, index, groups) => {
    const groupBatches = batches.filter((batch) =>
      group.batchIds.includes(batch.id),
    )
    const groupRows = rows.filter((row) => group.batchIds.includes(row.batchId))
    const currentQuantity = groupRows.reduce(
      (total, row) => total + row.currentQuantity,
      0,
    )

    return {
      batchIds: group.batchIds,
      batches: groupBatches,
      currentQuantity,
      key: group.key,
      rows: groupRows,
      title: groups.length > 1 ? `计价方案${index + 1}` : "计价方案",
      totalQuantity: getCustomerInventoryDeliveryTotalQuantity(groupRows),
    } satisfies CustomerInventoryDeliveryPriceGroupView
  })
}

export function getCustomerInventoryBatchPriceGroupKey(
  batch: Pick<
    CustomerInventoryBatch,
    | "aluminumIngotPriceX100"
    | "pricingTaxIncluded"
    | "bridgeProcessingFeeX100"
    | "powderProcessingFeeX100"
    | "billetProcessingFeeX100"
    | "oxidationProcessingFeeX100"
    | "electrophoresisProcessingFeeX100"
  >,
) {
  return [
    batch.aluminumIngotPriceX100,
    batch.pricingTaxIncluded ? 1 : 0,
    batch.bridgeProcessingFeeX100,
    batch.powderProcessingFeeX100,
    batch.billetProcessingFeeX100,
    batch.oxidationProcessingFeeX100,
    batch.electrophoresisProcessingFeeX100,
  ].join(":")
}

export function groupCustomerInventoryBatchesByPrice(
  batches: CustomerInventoryBatch[],
) {
  const groups = new Map<string, CustomerInventoryDeliveryPriceGroupSource>()

  for (const batch of batches) {
    const key = getCustomerInventoryBatchPriceGroupKey(batch)
    const group = groups.get(key)

    if (group) {
      group.batchIds.push(batch.id)
    } else {
      groups.set(key, {
        batchIds: [batch.id],
        key,
      })
    }
  }

  return Array.from(groups.values())
}

export function buildCustomerInventoryDeliveryGroups(
  rows: CustomerInventoryDeliveryRow[],
  getDefaultGroupLabel: (batchNote: string) => string,
) {
  return Array.from(
    rows
      .reduce((groups, row) => {
        const current = groups.get(row.batchId)
        const deliveryQuantity = parseIntegerInput(row.quantity)
        const validDeliveryQuantity =
          deliveryQuantity !== null && deliveryQuantity > 0
            ? deliveryQuantity
            : 0

        if (current) {
          current.itemCount += 1
          current.currentQuantity += row.currentQuantity
          current.deliveryQuantity += validDeliveryQuantity
          return groups
        }

        groups.set(row.batchId, {
          batchId: row.batchId,
          batchNote: row.batchNote,
          currentQuantity: row.currentQuantity,
          defaultGroupLabel: getDefaultGroupLabel(row.batchNote),
          deliveryQuantity: validDeliveryQuantity,
          groupLabel: row.groupLabel,
          itemCount: 1,
        })
        return groups
      }, new Map<string, CustomerInventoryDeliveryGroupView>())
      .values(),
  )
}

export function formatMovementSpec(movement: {
  color: string
  lengthMm: number | null
}) {
  if (!movement.lengthMm && !movement.color) {
    return "-"
  }

  return [movement.lengthMm ? `${movement.lengthMm}mm` : "", movement.color]
    .filter(Boolean)
    .join(" · ")
}

export function getInventoryNoticeClassName(tone: InventoryNotice["tone"]) {
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }

  if (tone === "info") {
    return "border-sky-200 bg-sky-50 text-sky-800"
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800"
}

export function getPublicInventoryNotice(payload: AdjustInventoryPayload) {
  if (payload.movementType === "adjust") {
    return `公共库存已盘点为 ${payload.quantity} 支`
  }

  return `公共库存已${movementText[payload.movementType]}，数量 ${payload.quantity} 支`
}

export function getOrderInventoryNotice(payload: AdjustOrderInventoryPayload) {
  if (payload.movementType === "adjust") {
    return `订单 ${payload.orderId} 库存已盘点为 ${payload.quantity} 支`
  }

  const action = payload.movementType === "produce" ? "入库" : "出库"
  return `订单 ${payload.orderId} 已${action} ${payload.quantity} 支`
}

export function getBatchOrderInventoryNotice(
  payload: AdjustOrderInventoryBatchPayload,
) {
  const totalQuantity = payload.items.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  return `订单 ${payload.orderId} 已批量入库 ${payload.items.length} 项，共 ${totalQuantity} 支`
}

export function getTransferInventoryNotice(
  payload: TransferPublicInventoryToOrderPayload,
) {
  return `订单 ${payload.orderId} 已从公共库存转入 ${payload.quantity} 支`
}

export function getDeliveryNoteNotice(deliveryNote: DeliveryNote) {
  const totalQuantity = deliveryNote.items.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  return `出库单已创建，出库 ${deliveryNote.items.length} 项，共 ${totalQuantity} 支`
}

export function getDeliveryNotePrintPreviewState(
  deliveryNote: DeliveryNote | null,
): DeliveryNotePrintPreviewState {
  const currentMergedDeliveryNote = deliveryNote
    ? buildMergedDeliveryNoteFromPersistedDeliveryNote(deliveryNote)
    : null

  return {
    currentDeliveryNote: currentMergedDeliveryNote ? null : deliveryNote,
    currentMergedDeliveryNote,
  }
}

export function getCustomerInventoryDeliveryCreateResult(
  deliveryNotes: DeliveryNote[],
  now = new Date(),
): CustomerInventoryDeliveryCreateResult {
  const firstDeliveryNote = deliveryNotes[0] ?? null
  const {
    currentMergedDeliveryNote: persistedMergedDeliveryNote,
  } = getDeliveryNotePrintPreviewState(firstDeliveryNote)
  const fallbackMergedDeliveryNote =
    deliveryNotes.length > 1
      ? buildMergedDeliveryNote({
          deliveryDate:
            firstDeliveryNote?.deliveryDate ?? formatDateInputValue(now),
          groupColumnLabel: "分组",
          id: firstDeliveryNote?.id ?? `KHCK${formatCompactDatePart(now)}`,
          notes: deliveryNotes,
          specialNote: firstDeliveryNote?.specialNote ?? "",
        })
      : null
  const currentMergedDeliveryNote =
    persistedMergedDeliveryNote ?? fallbackMergedDeliveryNote

  return {
    currentDeliveryNote: currentMergedDeliveryNote ? null : firstDeliveryNote,
    currentMergedDeliveryNote,
    message: persistedMergedDeliveryNote
      ? "客户库存合并出库已创建"
      : deliveryNotes.length > 1
        ? `客户库存合并出库已创建，生成 ${deliveryNotes.length} 张出库单`
        : firstDeliveryNote
          ? getDeliveryNoteNotice(firstDeliveryNote)
          : "客户库存出库已创建",
  }
}

export function getCustomerInventoryDeliveryNoteIds(batch: {
  deliveryNoteId: string | null
  deliveryNoteIds: string[]
}) {
  return Array.from(
    new Set(
      [batch.deliveryNoteId, ...batch.deliveryNoteIds].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  )
}

export function getDeliveryNotePriceGroupKey(deliveryNote: DeliveryNote) {
  return [
    deliveryNote.aluminumIngotPriceX100,
    deliveryNote.pricingTaxIncluded ? 1 : 0,
    deliveryNote.bridgeProcessingFeeX100,
    deliveryNote.powderProcessingFeeX100,
    deliveryNote.billetProcessingFeeX100,
    deliveryNote.oxidationProcessingFeeX100,
    deliveryNote.electrophoresisProcessingFeeX100,
  ].join(":")
}

export function buildMergedDeliveryNote({
  customGroupsByDeliveryNoteId = {},
  deliveryDate,
  groupColumnLabel = "分组",
  id,
  notes,
  note = "",
  specialNote = "",
}: MergedDeliveryNoteBuildOptions): MergedDeliveryNote {
  const firstNote = notes[0]
  const priceGroupEntries = new Map<
    string,
    { notes: DeliveryNote[]; sourceIndex: number }
  >()

  notes.forEach((deliveryNote, sourceIndex) => {
    const priceGroupKey = getDeliveryNotePriceGroupKey(deliveryNote)
    const entry = priceGroupEntries.get(priceGroupKey)

    if (entry) {
      entry.notes.push(deliveryNote)
    } else {
      priceGroupEntries.set(priceGroupKey, {
        notes: [deliveryNote],
        sourceIndex,
      })
    }
  })

  const priceGroupCount = priceGroupEntries.size
  const priceGroups = Array.from(priceGroupEntries.entries())
    .sort(([, left], [, right]) => left.sourceIndex - right.sourceIndex)
    .map(([, entry], index) =>
      buildMergedDeliveryNotePriceGroup(
        entry.notes,
        customGroupsByDeliveryNoteId,
        priceGroupCount > 1 ? `计价方案${index + 1}` : "商品明细",
      ),
    )

  return {
    customerAddress: firstNote?.customerAddress ?? "",
    customerName: firstNote?.customerName ?? "",
    deliveryDate,
    groupColumnLabel: groupColumnLabel.trim() || "分组",
    handlerName: firstNote?.handlerName ?? "",
    id,
    note,
    priceGroups,
    specialNote,
    sourceDeliveryNoteIds: notes.map((deliveryNote) => deliveryNote.id),
  }
}

export function buildMergedDeliveryNoteFromPersistedDeliveryNote(
  deliveryNote: DeliveryNote,
): MergedDeliveryNote | null {
  const priceGroups = deliveryNote.priceGroups ?? []

  if (priceGroups.length <= 1) {
    return null
  }

  return {
    customerAddress: deliveryNote.customerAddress,
    customerName: deliveryNote.customerName,
    deliveryDate: deliveryNote.deliveryDate,
    groupColumnLabel: "分组",
    handlerName: deliveryNote.handlerName,
    id: deliveryNote.id,
    note: deliveryNote.note,
    specialNote: deliveryNote.specialNote ?? "",
    priceGroups: priceGroups.map((priceGroup) => ({
      aluminumIngotPriceX100: priceGroup.aluminumIngotPriceX100,
      billetProcessingFeeX100: priceGroup.billetProcessingFeeX100,
      billetWeightKgX100: priceGroup.billetWeightKgX100,
      bridgeProcessingFeeX100: priceGroup.bridgeProcessingFeeX100,
      bridgeWeightKgX100: priceGroup.bridgeWeightKgX100,
      electrophoresisProcessingFeeX100:
        priceGroup.electrophoresisProcessingFeeX100,
      electrophoresisWeightKgX100: priceGroup.electrophoresisWeightKgX100,
      extraCharges: priceGroup.extraCharges.map((row) => ({ ...row })),
      id: priceGroup.id,
      items: priceGroup.items.map((item) => ({
        ...item,
        customGroup: item.groupLabel?.trim() ?? "",
        sourceDeliveryNoteId: deliveryNote.id,
        sourceOrderId: item.sourceBatchId ?? deliveryNote.orderId,
      })),
      oxidationProcessingFeeX100: priceGroup.oxidationProcessingFeeX100,
      oxidationWeightKgX100: priceGroup.oxidationWeightKgX100,
      powderProcessingFeeX100: priceGroup.powderProcessingFeeX100,
      powderWeightKgX100: priceGroup.powderWeightKgX100,
      pricingTaxIncluded: priceGroup.pricingTaxIncluded,
      sourceDeliveryNoteIds: [deliveryNote.id],
      title: priceGroup.title,
    })),
    sourceDeliveryNoteIds: [deliveryNote.id],
  }
}

export function getMergedDeliveryNoteCustomerName(
  items: Array<{ customerName: string }>,
) {
  const customerName = items[0]?.customerName ?? ""

  if (!customerName || items.some((item) => item.customerName !== customerName)) {
    return null
  }

  return customerName
}

export function getMissingRequiredMergedDeliveryGroupIds(
  notes: DeliveryNote[],
  customGroupsByDeliveryNoteId: Record<string, string>,
) {
  const notesByPriceGroup = new Map<string, DeliveryNote[]>()

  for (const deliveryNote of notes) {
    const priceGroupKey = getDeliveryNotePriceGroupKey(deliveryNote)
    const groupNotes = notesByPriceGroup.get(priceGroupKey) ?? []

    groupNotes.push(deliveryNote)
    notesByPriceGroup.set(priceGroupKey, groupNotes)
  }

  return Array.from(notesByPriceGroup.values())
    .filter((groupNotes) => groupNotes.length >= 2)
    .flatMap((groupNotes) =>
      groupNotes
        .filter(
          (deliveryNote) =>
            !customGroupsByDeliveryNoteId[deliveryNote.id]?.trim(),
        )
        .map((deliveryNote) => deliveryNote.id),
    )
}

export function buildMergedDeliveryNotePreview({
  customGroupsByDeliveryNoteId = {},
  notes,
  now = new Date(),
  specialNote = "",
}: MergedDeliveryNotePreviewOptions): MergedDeliveryNotePreviewResult {
  if (!getMergedDeliveryNoteCustomerName(notes)) {
    return {
      errorMessage: "只能合并同一客户的出库单",
      mergedDeliveryNote: null,
    }
  }

  const missingGroupIds = getMissingRequiredMergedDeliveryGroupIds(
    notes,
    customGroupsByDeliveryNoteId,
  )

  if (missingGroupIds.length > 0) {
    return {
      errorMessage: `同一计价方案下包含多张出库单，请填写分组说明：${missingGroupIds.join("、")}`,
      mergedDeliveryNote: null,
    }
  }

  return {
    errorMessage: null,
    mergedDeliveryNote: buildMergedDeliveryNote({
      customGroupsByDeliveryNoteId,
      deliveryDate: formatDateInputValue(now),
      id: `HD${formatCompactDatePart(now)}`,
      notes,
      specialNote,
    }),
  }
}

function buildMergedDeliveryNotePriceGroup(
  notes: DeliveryNote[],
  customGroupsByDeliveryNoteId: Record<string, string>,
  title: string,
): MergedDeliveryNotePriceGroup {
  const firstNote = notes[0]
  const groupOrder = new Map<string, number>()
  const items = notes.flatMap((deliveryNote, noteIndex) => {
    const noteCustomGroup = (
      customGroupsByDeliveryNoteId[deliveryNote.id] ?? ""
    ).trim()

    return deliveryNote.items.map((item, itemIndex) => {
      const customGroup = (noteCustomGroup || item.groupLabel || "").trim()

      if (customGroup && !groupOrder.has(customGroup)) {
        groupOrder.set(customGroup, groupOrder.size)
      }

      return {
        ...item,
        customGroup,
        id: `${deliveryNote.id}:${item.id}`,
        sourceDeliveryNoteId: deliveryNote.id,
        sourceOrderId: deliveryNote.orderId,
        sortIndex: noteIndex * 10000 + itemIndex,
      }
    })
  })

  const sortedItems = items
    .sort((left, right) => {
      const leftGroupIndex =
        left.customGroup && groupOrder.has(left.customGroup)
          ? groupOrder.get(left.customGroup)!
          : Number.MAX_SAFE_INTEGER
      const rightGroupIndex =
        right.customGroup && groupOrder.has(right.customGroup)
          ? groupOrder.get(right.customGroup)!
          : Number.MAX_SAFE_INTEGER

      if (leftGroupIndex !== rightGroupIndex) {
        return leftGroupIndex - rightGroupIndex
      }

      return left.sortIndex - right.sortIndex
    })
    .map(({ sortIndex: _sortIndex, ...item }) => item)

  return {
    aluminumIngotPriceX100: firstNote?.aluminumIngotPriceX100 ?? 0,
    billetProcessingFeeX100: firstNote?.billetProcessingFeeX100 ?? 0,
    billetWeightKgX100: sumDeliveryNoteField(notes, "billetWeightKgX100"),
    bridgeProcessingFeeX100: firstNote?.bridgeProcessingFeeX100 ?? 0,
    bridgeWeightKgX100: sumDeliveryNoteField(notes, "bridgeWeightKgX100"),
    electrophoresisProcessingFeeX100:
      firstNote?.electrophoresisProcessingFeeX100 ?? 0,
    electrophoresisWeightKgX100: sumDeliveryNoteField(
      notes,
      "electrophoresisWeightKgX100",
    ),
    extraCharges: notes.flatMap((note) => note.extraCharges.map((row) => ({ ...row }))),
    id: getDeliveryNotePriceGroupKey(firstNote),
    items: sortedItems,
    oxidationProcessingFeeX100: firstNote?.oxidationProcessingFeeX100 ?? 0,
    oxidationWeightKgX100: sumDeliveryNoteField(notes, "oxidationWeightKgX100"),
    powderProcessingFeeX100: firstNote?.powderProcessingFeeX100 ?? 0,
    powderWeightKgX100: sumDeliveryNoteField(notes, "powderWeightKgX100"),
    pricingTaxIncluded: firstNote?.pricingTaxIncluded ?? true,
    sourceDeliveryNoteIds: notes.map((deliveryNote) => deliveryNote.id),
    title,
  }
}

function sumDeliveryNoteField<Key extends keyof DeliveryNote>(
  notes: DeliveryNote[],
  key: Key,
) {
  return notes.reduce((total, deliveryNote) => {
    const value = deliveryNote[key]
    return total + (typeof value === "number" ? value : 0)
  }, 0)
}


export function getMergedDeliveryNotePrintRows(
  items: MergedDeliveryNoteItem[],
): MergedDeliveryNotePrintRow[] {
  return items.map((item, index) => {
    if (!item.customGroup) {
      return { ...item, customGroupRowSpan: 0, showCustomGroup: false }
    }

    const previousItem = items[index - 1]
    if (previousItem?.customGroup === item.customGroup) {
      return { ...item, customGroupRowSpan: 0, showCustomGroup: false }
    }

    let rowSpan = 1
    for (
      let nextIndex = index + 1;
      nextIndex < items.length &&
      items[nextIndex].customGroup === item.customGroup;
      nextIndex += 1
    ) {
      rowSpan += 1
    }

    return { ...item, customGroupRowSpan: rowSpan, showCustomGroup: true }
  })
}

export function parseWeightKgToX100(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return 0
  }

  const weight = Number.parseFloat(trimmedValue)
  return Number.isFinite(weight) && weight >= 0 ? Math.round(weight * 100) : null
}

export function getRequiredDeliveryWeights(rows: DeliveryNoteFormRow[]) {
  return rows.reduce(
    (required, row) => {
      const quantity = parseIntegerInput(row.quantity)

      if (quantity === null || quantity <= 0) {
        return required
      }

      const category = getProcessingCategoryFromColor(row.color)

      if (category === "billet") {
        required.billet = true
      } else if (category === "bridge") {
        required.bridge = true
      } else if (category === "oxidation") {
        required.oxidation = true
      } else if (category === "electrophoresis") {
        required.electrophoresis = true
      } else {
        required.powder = true
      }

      return required
    },
    {
      billet: false,
      bridge: false,
      electrophoresis: false,
      oxidation: false,
      powder: false,
    },
  )
}

export function getInventoryDetailKey(detail: {
  color: string
  lengthMm: number
  productId: string
}) {
  return `${detail.productId}:${detail.lengthMm}:${detail.color}`
}

export function getOrderGroupStats(group: OrderInventoryGroup) {
  const requiredQuantity = group.items.reduce(
    (total, item) => total + item.requiredQuantity,
    0,
  )
  const orderQuantity = group.items.reduce(
    (total, item) => total + item.orderQuantity,
    0,
  )
  const publicQuantity = group.items.reduce(
    (total, item) => total + (item.publicQuantity ?? 0),
    0,
  )

  return {
    hasOverStock: orderQuantity > requiredQuantity,
    isDelivered: Boolean(group.inventoryLockedAt),
    orderQuantity,
    pendingQuantity: Math.max(requiredQuantity - orderQuantity, 0),
    publicQuantity,
    requiredQuantity,
  }
}

export function getInventoryOverviewStats({
  customerInventoryBatches,
  customerInventoryTotalQuantity,
  orderGroups,
  publicInventoryItems,
  publicInventoryTotalQuantity,
}: {
  customerInventoryBatches: ArrayLike<unknown>
  customerInventoryTotalQuantity: number
  orderGroups: OrderInventoryGroup[]
  publicInventoryItems: ArrayLike<unknown>
  publicInventoryTotalQuantity: number
}): InventoryOverviewStats {
  const orderInventoryTotalQuantity = orderGroups.reduce(
    (total, group) => total + getOrderGroupStats(group).orderQuantity,
    0,
  )

  return {
    customerInventoryBatchCount: customerInventoryBatches.length,
    customerInventoryTotalStockQuantity: customerInventoryTotalQuantity,
    inventoryOverviewTotalQuantity:
      publicInventoryTotalQuantity +
      orderInventoryTotalQuantity +
      customerInventoryTotalQuantity,
    orderInventoryOrderCount: orderGroups.length,
    orderInventoryTotalQuantity,
    publicInventoryItemCount: publicInventoryItems.length,
    publicInventoryTotalQuantity,
  }
}

export function buildOrderInventoryGroups(orderItems: OrderInventoryItem[]) {
  const groups = new Map<string, OrderInventoryGroup>()

  for (const item of orderItems) {
    const group =
      groups.get(item.orderId) ??
      ({
        customerAddress: item.customerAddress,
        customerName: item.customerName,
        deliveryNoteId: item.deliveryNoteId,
        deliveryNoteIds: item.deliveryNoteIds,
        handlerName: item.handlerName,
        inventoryCloseDestination: item.inventoryCloseDestination,
        inventoryClosedAt: item.inventoryClosedAt,
        inventoryLockedAt: item.inventoryLockedAt,
        items: [],
        orderedDate: item.orderedDate,
        orderId: item.orderId,
        orderNote: item.orderNote,
        pricingTaxIncluded: item.pricingTaxIncluded,
      } satisfies OrderInventoryGroup)

    group.items.push(item)
    groups.set(item.orderId, group)
  }

  return Array.from(groups.values())
}

export function getDeliveredOrderGroups(groups: OrderInventoryGroup[]) {
  return groups.flatMap((group) =>
    group.deliveryNoteIds.map((deliveryNoteId) => ({
      ...group,
      deliveryNoteId,
    })),
  )
}

export function getDeliveredOrderGroupsByDeliveryNoteId(
  groups: OrderInventoryGroup[],
) {
  const groupsByDeliveryNoteId = new Map<string, OrderInventoryGroup>()

  for (const group of groups) {
    for (const deliveryNoteId of group.deliveryNoteIds) {
      groupsByDeliveryNoteId.set(deliveryNoteId, {
        ...group,
        deliveryNoteId,
      })
    }
  }

  return groupsByDeliveryNoteId
}

export function selectDeliveredOrderGroupsByDeliveryNoteIds(
  groupsByDeliveryNoteId: Map<string, OrderInventoryGroup>,
  deliveryNoteIds: string[],
) {
  return deliveryNoteIds
    .map((deliveryNoteId) => groupsByDeliveryNoteId.get(deliveryNoteId))
    .filter((group): group is OrderInventoryGroup => Boolean(group))
}

export function filterOrderInventoryGroups(
  groups: OrderInventoryGroup[],
  filter: OrderInventoryFilter,
) {
  return groups.filter((group) => matchesOrderInventoryFilter(group, filter))
}

export function getOrderInventoryFilterCounts(groups: OrderInventoryGroup[]) {
  return orderInventoryFilters.reduce(
    (counts, filter) => ({
      ...counts,
      [filter.value]: filterOrderInventoryGroups(groups, filter.value).length,
    }),
    {} as Record<OrderInventoryFilter, number>,
  )
}

export function getOrderInventoryStatus(
  requiredQuantity: number,
  currentQuantity: number,
) {
  if (currentQuantity > requiredQuantity) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      label: `超入库 ${currentQuantity - requiredQuantity} 支`,
    }
  }

  if (currentQuantity === requiredQuantity) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "已入齐",
    }
  }

  return {
    className: "border-sky-200 bg-sky-50 text-sky-700",
    label: `建议入库 ${requiredQuantity - currentQuantity} 支`,
  }
}

export function matchesOrderInventoryFilter(
  group: OrderInventoryGroup,
  filter: OrderInventoryFilter,
) {
  const stats = getOrderGroupStats(group)

  if (filter === "pending") {
    return !stats.isDelivered && stats.pendingQuantity > 0
  }

  if (filter === "stocked") {
    return !stats.isDelivered && stats.orderQuantity > 0
  }

  if (filter === "delivered") {
    return stats.isDelivered
  }

  if (filter === "overstock") {
    return stats.hasOverStock
  }

  return true
}

export function normalizeMoldCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase()
}

export function normalizeOcrMoldCodeForLookup(value: string) {
  const chars = Array.from(normalizeMoldCode(value))

  return chars
    .map((char, index) => {
      const previousIsDigit = index > 0 && /\d/.test(chars[index - 1]!)
      const nextIsDigit = index + 1 < chars.length && /\d/.test(chars[index + 1]!)

      return char === "O" && (previousIsDigit || nextIsDigit) ? "0" : char
    })
    .join("")
}

export function normalizeInventoryLengthMm(value: number) {
  return value > 0 && value < 100 ? Math.round(value * 1000) : value
}

export function normalizeInventoryColorGroup(value: string) {
  if (value.includes("坯料")) {
    return "坯料"
  }

  if (value.includes("白")) {
    return "白"
  }

  if (value.includes("灰")) {
    return "灰"
  }

  return value.trim()
}

export function withRecognizedOrderMoldCode(
  item: RecognizedInventoryImageItem,
  moldCode: string,
) {
  if (item.moldCode === moldCode) {
    return item
  }

  return {
    ...item,
    moldCode,
  }
}

function withRecognizedOrderMatch(
  item: RecognizedInventoryImageItem,
  row: BatchOrderInventoryRow,
) {
  const recognizedItem = withRecognizedOrderMoldCode(item, row.moldCode)

  if (recognizedItem.lengthMm === row.lengthMm) {
    return recognizedItem
  }

  return {
    ...recognizedItem,
    lengthMm: row.lengthMm,
  }
}

function getBatchOrderImageRecognitionMatchKey(
  match: BatchOrderImageRecognitionMatch,
) {
  return [
    normalizeOcrMoldCodeForLookup(match.item.moldCode),
    normalizeInventoryColorGroup(match.item.color),
    normalizeInventoryLengthMm(match.item.lengthMm),
  ].join("|")
}

function getBatchOrderImageRecognitionMatchScore(
  match: BatchOrderImageRecognitionMatch,
) {
  const statusScore: Record<BatchOrderImageRecognitionStatus, number> = {
    matched: 100,
    ambiguous: 50,
    unmatched: 0,
  }

  return statusScore[match.status] + (match.item.quantity ? 1 : 0)
}

export function getRecognizedOrderMoldCode(
  item: RecognizedInventoryImageItem,
  rows: BatchOrderInventoryRow[],
) {
  const itemMoldCode = normalizeMoldCode(item.moldCode)
  const itemLookupMoldCode = normalizeOcrMoldCodeForLookup(item.moldCode)
  const exactMoldCodes = Array.from(
    new Set(
      rows
        .filter((row) => normalizeMoldCode(row.moldCode) === itemMoldCode)
        .map((row) => row.moldCode),
    ),
  )

  if (exactMoldCodes.length === 1) {
    return exactMoldCodes[0]
  }

  const lookupMoldCodes = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            normalizeOcrMoldCodeForLookup(row.moldCode) === itemLookupMoldCode,
        )
        .map((row) => row.moldCode),
    ),
  )

  return lookupMoldCodes.length === 1 ? lookupMoldCodes[0] : null
}

function getBatchOrderImageLengthCandidates(
  rows: BatchOrderInventoryRow[],
  recognizedMoldCode: string,
  itemColorGroup: string,
  itemLengthMm: number,
) {
  const sameProductColorRows = rows.filter(
    (row) =>
      row.moldCode === recognizedMoldCode &&
      normalizeInventoryColorGroup(row.color) === itemColorGroup,
  )
  const exactCandidates = sameProductColorRows.filter(
    (row) => normalizeInventoryLengthMm(row.lengthMm) === itemLengthMm,
  )

  if (exactCandidates.length > 0) {
    return exactCandidates
  }

  return sameProductColorRows.filter((row) => {
    const rowLengthMm = normalizeInventoryLengthMm(row.lengthMm)
    const extraLengthMm = itemLengthMm - rowLengthMm

    return (
      extraLengthMm > 0 &&
      extraLengthMm <= BATCH_ORDER_IMAGE_LENGTH_SNAP_TOLERANCE_MM
    )
  })
}

export function dedupeBatchOrderImageRecognitionMatches(
  matches: BatchOrderImageRecognitionMatch[],
) {
  const mergedMatches = new Map<string, BatchOrderImageRecognitionMatch>()

  for (const match of matches) {
    const matchKey = getBatchOrderImageRecognitionMatchKey(match)
    const existingMatch = mergedMatches.get(matchKey)

    if (!existingMatch) {
      mergedMatches.set(matchKey, match)
      continue
    }

    if (
      getBatchOrderImageRecognitionMatchScore(match) >
      getBatchOrderImageRecognitionMatchScore(existingMatch)
    ) {
      mergedMatches.set(matchKey, match)
    }
  }

  return Array.from(mergedMatches.values())
}

export function buildBatchOrderImageRecognitionMatches(
  items: RecognizedInventoryImageItem[],
  rows: BatchOrderInventoryRow[],
) {
  const matches = items.map((item): BatchOrderImageRecognitionMatch => {
    const recognizedMoldCode = getRecognizedOrderMoldCode(item, rows)

    if (!recognizedMoldCode) {
      return {
        item,
        message: "未匹配到当前订单明细",
        status: "unmatched",
      }
    }

    const itemLengthMm = normalizeInventoryLengthMm(item.lengthMm)
    const itemColorGroup = normalizeInventoryColorGroup(item.color)
    const lookupCandidates = getBatchOrderImageLengthCandidates(
      rows,
      recognizedMoldCode,
      itemColorGroup,
      itemLengthMm,
    )

    if (lookupCandidates.length === 1) {
      return {
        detailKey: getInventoryDetailKey(lookupCandidates[0]!),
        item: withRecognizedOrderMatch(item, lookupCandidates[0]!),
        message:
          item.quantity === null || item.quantity <= 0
            ? "已匹配，待识别支数"
            : "已匹配",
        status: "matched",
      }
    }

    if (lookupCandidates.length > 1) {
      return {
        candidates: lookupCandidates,
        item: withRecognizedOrderMoldCode(item, recognizedMoldCode),
        message: `匹配到 ${lookupCandidates.length} 条订单颜色，请手动确认`,
        status: "ambiguous",
      }
    }

    return {
      item: withRecognizedOrderMoldCode(item, recognizedMoldCode),
      message: "未匹配到当前订单明细",
      status: "unmatched",
    }
  })

  return matches
}
