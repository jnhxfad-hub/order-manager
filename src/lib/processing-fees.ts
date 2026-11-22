export type ProcessingCategory =
  | "bridge"
  | "powder"
  | "billet"
  | "oxidation"
  | "electrophoresis"

export type ProcessingFeeSnapshotKey =
  | "bridgeProcessingFeeX100"
  | "powderProcessingFeeX100"
  | "billetProcessingFeeX100"
  | "oxidationProcessingFeeX100"
  | "electrophoresisProcessingFeeX100"
export type ProcessingFeeSnapshotX100 = Record<ProcessingFeeSnapshotKey, number>

export const processingFeeSnapshotKeys = {
  billet: "billetProcessingFeeX100",
  bridge: "bridgeProcessingFeeX100",
  electrophoresis: "electrophoresisProcessingFeeX100",
  oxidation: "oxidationProcessingFeeX100",
  powder: "powderProcessingFeeX100",
} as const satisfies Record<ProcessingCategory, ProcessingFeeSnapshotKey>

export const processingCategories = [
  {
    colorClassName: "断桥",
    key: "bridge",
    label: "断桥",
  },
  {
    colorClassName: "喷涂",
    key: "powder",
    label: "喷涂",
  },
  {
    colorClassName: "坯料",
    key: "billet",
    label: "坯料",
  },
  {
    colorClassName: "氧化",
    key: "oxidation",
    label: "氧化",
  },
  {
    colorClassName: "电泳",
    key: "electrophoresis",
    label: "电泳",
  },
] as const satisfies Array<{
  colorClassName: string
  key: ProcessingCategory
  label: string
}>

export function emptyProcessingFeeSnapshotX100() {
  return processingCategories.reduce(
    (fees, category) => {
      fees[processingFeeSnapshotKeys[category.key]] = 0
      return fees
    },
    {} as ProcessingFeeSnapshotX100
  )
}

export function getProcessingFeeSnapshotValue(
  fees: ProcessingFeeSnapshotX100,
  category: ProcessingCategory
) {
  return fees[processingFeeSnapshotKeys[category]]
}

export function hasAnyProcessingFeeSnapshotValue(
  fees: ProcessingFeeSnapshotX100
) {
  return processingCategories.some(
    (category) => fees[processingFeeSnapshotKeys[category.key]] > 0
  )
}

export function getProcessingCategoryLabel(category: ProcessingCategory) {
  return (
    processingCategories.find((item) => item.key === category)?.label ?? "喷涂"
  )
}

export function getProcessingCategoryQuantityItems(
  items: Array<{ color: string; quantity: number }>
) {
  const itemGroups = items.reduce(
    (groups, item) => {
      if (!item.color.trim() || item.quantity <= 0) {
        return groups
      }

      const category = getProcessingCategoryFromColor(item.color)

      groups[category] += item.quantity

      return groups
    },
    {
      billet: 0,
      bridge: 0,
      electrophoresis: 0,
      oxidation: 0,
      powder: 0,
    } satisfies Record<ProcessingCategory, number>
  )

  return processingCategories
    .map((category) => ({
      label: getProcessingCategoryLabel(category.key),
      value: itemGroups[category.key],
    }))
    .filter((item) => item.value > 0)
}

export function getProcessingCategoryFromColor(
  color: string
): ProcessingCategory {
  const normalizedColor = color.trim()
  const matchedCategories: ProcessingCategory[] = []

  if (normalizedColor.includes("坯料")) {
    matchedCategories.push("billet")
  }

  if (
    normalizedColor.includes("双面") ||
    (normalizedColor.includes("外") && normalizedColor.includes("内"))
  ) {
    matchedCategories.push("bridge")
  }

  if (normalizedColor.includes("氧化")) {
    matchedCategories.push("oxidation")
  }

  if (/[123]#色/.test(normalizedColor)) {
    matchedCategories.push("electrophoresis")
  }

  if (matchedCategories.length === 0) {
    return "powder"
  }

  return matchedCategories[0]
}

export function getProcessingCategoryConflict(color: string) {
  const normalizedColor = color.trim()
  const matchedCategories = [
    normalizedColor.includes("坯料") ? "坯料" : null,
    normalizedColor.includes("双面") ||
    (normalizedColor.includes("外") && normalizedColor.includes("内"))
      ? "断桥"
      : null,
    normalizedColor.includes("氧化") ? "氧化" : null,
    normalizedColor.includes("1#色") ||
    normalizedColor.includes("2#色") ||
    normalizedColor.includes("3#色")
      ? "电泳"
      : null,
  ].filter(Boolean) as string[]

  if (matchedCategories.length <= 1) {
    return null
  }

  return `颜色“${normalizedColor}”同时命中${matchedCategories.join("、")}，请检查颜色录入`
}
