import type { Customer } from "@/features/customers/types"
import {
  emptyProcessingFeeSnapshotX100,
  hasAnyProcessingFeeSnapshotValue,
  processingCategories,
  processingFeeSnapshotKeys,
  type ProcessingCategory,
  type ProcessingFeeSnapshotX100,
} from "@/lib/processing-fees"

type CustomerProcessingFeeGroup = "regular" | "special"

const customerProcessingFeeFieldPrefixes = {
  billet: { regular: "billet", special: "specialBillet" },
  bridge: { regular: "bridge", special: "specialBridge" },
  electrophoresis: {
    regular: "electrophoresis",
    special: "specialElectrophoresis",
  },
  oxidation: { regular: "oxidation", special: "specialOxidation" },
  powder: { regular: "powder", special: "specialPowder" },
} as const satisfies Record<
  ProcessingCategory,
  Record<CustomerProcessingFeeGroup, string>
>

type CustomerProcessingFeeFieldPrefix =
  (typeof customerProcessingFeeFieldPrefixes)[ProcessingCategory][CustomerProcessingFeeGroup]
type CustomerProcessingFeeTaxSegment = "TaxExcluded" | "TaxIncluded"
type CustomerProcessingFeeField =
  `${CustomerProcessingFeeFieldPrefix}ProcessingFee${CustomerProcessingFeeTaxSegment}X100`

export function getMatchedSpecialPricingKeyword(
  customer: Customer | null | undefined,
  note: string,
) {
  const specialPricingKeyword = customer?.specialPricingKeyword.trim() ?? ""

  return specialPricingKeyword && note.includes(specialPricingKeyword)
    ? specialPricingKeyword
    : ""
}

export function getCustomerProcessingFeesX100(
  customer: Customer | null | undefined,
  pricingTaxIncluded: boolean,
  note = "",
): ProcessingFeeSnapshotX100 {
  if (!customer) {
    return emptyProcessingFeeSnapshotX100()
  }

  const group: CustomerProcessingFeeGroup = getMatchedSpecialPricingKeyword(
    customer,
    note,
  )
    ? "special"
    : "regular"
  const taxSegment: CustomerProcessingFeeTaxSegment = pricingTaxIncluded
    ? "TaxIncluded"
    : "TaxExcluded"

  return processingCategories.reduce((fees, category) => {
    const fieldPrefix =
      customerProcessingFeeFieldPrefixes[category.key][group]
    const customerField =
      `${fieldPrefix}ProcessingFee${taxSegment}X100` as CustomerProcessingFeeField

    fees[processingFeeSnapshotKeys[category.key]] = customer[customerField]
    return fees
  }, emptyProcessingFeeSnapshotX100())
}

export function hasAnyCustomerProcessingFee(
  customer: Customer | null | undefined,
  pricingTaxIncluded: boolean,
  note = "",
) {
  return hasAnyProcessingFeeSnapshotValue(
    getCustomerProcessingFeesX100(customer, pricingTaxIncluded, note),
  )
}
