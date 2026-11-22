import type { CustomerFormPayload } from "@/features/customers/api/customers-api"
import type { Customer } from "@/features/customers/types"
import {
  formatMoneyInput,
  formatOptionalCurrencyX100,
  formatPlainMoneyX100,
  parseMoneyToX100,
} from "@/lib/money"
import {
  processingCategories,
  type ProcessingCategory,
} from "@/lib/processing-fees"

export type DefaultPricingTaxIncluded = "included" | "excluded" | ""

export type CustomerFormValues = {
  customerName: string
  phone: string
  customerAddress: string
  defaultPricingTaxIncluded: DefaultPricingTaxIncluded
  bridgeProcessingFeeTaxIncluded: string
  powderProcessingFeeTaxIncluded: string
  billetProcessingFeeTaxIncluded: string
  oxidationProcessingFeeTaxIncluded: string
  electrophoresisProcessingFeeTaxIncluded: string
  bridgeProcessingFeeTaxExcluded: string
  powderProcessingFeeTaxExcluded: string
  billetProcessingFeeTaxExcluded: string
  oxidationProcessingFeeTaxExcluded: string
  electrophoresisProcessingFeeTaxExcluded: string
  specialPricingKeyword: string
  specialBridgeProcessingFeeTaxIncluded: string
  specialPowderProcessingFeeTaxIncluded: string
  specialBilletProcessingFeeTaxIncluded: string
  specialOxidationProcessingFeeTaxIncluded: string
  specialElectrophoresisProcessingFeeTaxIncluded: string
  specialBridgeProcessingFeeTaxExcluded: string
  specialPowderProcessingFeeTaxExcluded: string
  specialBilletProcessingFeeTaxExcluded: string
  specialOxidationProcessingFeeTaxExcluded: string
  specialElectrophoresisProcessingFeeTaxExcluded: string
}

export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>

export type ProcessingFeeFormKey =
  | "bridgeProcessingFeeTaxIncluded"
  | "powderProcessingFeeTaxIncluded"
  | "billetProcessingFeeTaxIncluded"
  | "oxidationProcessingFeeTaxIncluded"
  | "electrophoresisProcessingFeeTaxIncluded"
  | "bridgeProcessingFeeTaxExcluded"
  | "powderProcessingFeeTaxExcluded"
  | "billetProcessingFeeTaxExcluded"
  | "oxidationProcessingFeeTaxExcluded"
  | "electrophoresisProcessingFeeTaxExcluded"
  | "specialBridgeProcessingFeeTaxIncluded"
  | "specialPowderProcessingFeeTaxIncluded"
  | "specialBilletProcessingFeeTaxIncluded"
  | "specialOxidationProcessingFeeTaxIncluded"
  | "specialElectrophoresisProcessingFeeTaxIncluded"
  | "specialBridgeProcessingFeeTaxExcluded"
  | "specialPowderProcessingFeeTaxExcluded"
  | "specialBilletProcessingFeeTaxExcluded"
  | "specialOxidationProcessingFeeTaxExcluded"
  | "specialElectrophoresisProcessingFeeTaxExcluded"

export type ProcessingFeeField = {
  id: string
  key: ProcessingFeeFormKey
  label: string
}

type ProcessingFeeFieldGroup =
  | "excluded"
  | "included"
  | "specialExcluded"
  | "specialIncluded"

export const customerFormDefaultValues: CustomerFormValues = {
  customerName: "",
  phone: "",
  customerAddress: "",
  defaultPricingTaxIncluded: "",
  bridgeProcessingFeeTaxIncluded: "",
  powderProcessingFeeTaxIncluded: "",
  billetProcessingFeeTaxIncluded: "",
  oxidationProcessingFeeTaxIncluded: "",
  electrophoresisProcessingFeeTaxIncluded: "",
  bridgeProcessingFeeTaxExcluded: "",
  powderProcessingFeeTaxExcluded: "",
  billetProcessingFeeTaxExcluded: "",
  oxidationProcessingFeeTaxExcluded: "",
  electrophoresisProcessingFeeTaxExcluded: "",
  specialPricingKeyword: "",
  specialBridgeProcessingFeeTaxIncluded: "",
  specialPowderProcessingFeeTaxIncluded: "",
  specialBilletProcessingFeeTaxIncluded: "",
  specialOxidationProcessingFeeTaxIncluded: "",
  specialElectrophoresisProcessingFeeTaxIncluded: "",
  specialBridgeProcessingFeeTaxExcluded: "",
  specialPowderProcessingFeeTaxExcluded: "",
  specialBilletProcessingFeeTaxExcluded: "",
  specialOxidationProcessingFeeTaxExcluded: "",
  specialElectrophoresisProcessingFeeTaxExcluded: "",
}

const processingFeeKeys = {
  billet: {
    excluded: "billetProcessingFeeTaxExcluded",
    included: "billetProcessingFeeTaxIncluded",
    specialExcluded: "specialBilletProcessingFeeTaxExcluded",
    specialIncluded: "specialBilletProcessingFeeTaxIncluded",
  },
  bridge: {
    excluded: "bridgeProcessingFeeTaxExcluded",
    included: "bridgeProcessingFeeTaxIncluded",
    specialExcluded: "specialBridgeProcessingFeeTaxExcluded",
    specialIncluded: "specialBridgeProcessingFeeTaxIncluded",
  },
  electrophoresis: {
    excluded: "electrophoresisProcessingFeeTaxExcluded",
    included: "electrophoresisProcessingFeeTaxIncluded",
    specialExcluded: "specialElectrophoresisProcessingFeeTaxExcluded",
    specialIncluded: "specialElectrophoresisProcessingFeeTaxIncluded",
  },
  oxidation: {
    excluded: "oxidationProcessingFeeTaxExcluded",
    included: "oxidationProcessingFeeTaxIncluded",
    specialExcluded: "specialOxidationProcessingFeeTaxExcluded",
    specialIncluded: "specialOxidationProcessingFeeTaxIncluded",
  },
  powder: {
    excluded: "powderProcessingFeeTaxExcluded",
    included: "powderProcessingFeeTaxIncluded",
    specialExcluded: "specialPowderProcessingFeeTaxExcluded",
    specialIncluded: "specialPowderProcessingFeeTaxIncluded",
  },
} satisfies Record<
  ProcessingCategory,
  Record<ProcessingFeeFieldGroup, ProcessingFeeFormKey>
>

function buildProcessingFeeFields(
  group: ProcessingFeeFieldGroup,
  idSuffix: string,
) {
  return processingCategories.map((category) => ({
    id: `${category.key}-processing-fee-${idSuffix}`,
    key: processingFeeKeys[category.key][group],
    label: category.label,
  }))
}

export const includedProcessingFeeFields = buildProcessingFeeFields(
  "included",
  "tax-included",
)
export const excludedProcessingFeeFields = buildProcessingFeeFields(
  "excluded",
  "tax-excluded",
)
export const specialIncludedProcessingFeeFields = buildProcessingFeeFields(
  "specialIncluded",
  "special-tax-included",
)
export const specialExcludedProcessingFeeFields = buildProcessingFeeFields(
  "specialExcluded",
  "special-tax-excluded",
)

export const allProcessingFeeFields = [
  ...includedProcessingFeeFields,
  ...excludedProcessingFeeFields,
  ...specialIncludedProcessingFeeFields,
  ...specialExcludedProcessingFeeFields,
]

export const processingFeeFieldsWithGroupLabels = [
  ...includedProcessingFeeFields.map((field) => ({
    ...field,
    groupLabel: "含税",
  })),
  ...excludedProcessingFeeFields.map((field) => ({
    ...field,
    groupLabel: "不含税",
  })),
  ...specialIncludedProcessingFeeFields.map((field) => ({
    ...field,
    groupLabel: "特殊含税",
  })),
  ...specialExcludedProcessingFeeFields.map((field) => ({
    ...field,
    groupLabel: "特殊不含税",
  })),
]

export function formatCustomerMoneyX100(value: number) {
  return formatOptionalCurrencyX100(value)
}

export function validatePhone(value: string) {
  const phone = value.trim()

  if (!phone) {
    return null
  }

  if (!/^[\d+\-\s]+$/.test(phone)) {
    return "请输入正确的手机号"
  }

  return null
}

export function validateMoney(value: string, label: string) {
  return parseMoneyToX100(value) === null
    ? `${label}只能输入非负金额，最多两位小数`
    : null
}

export function hasConfiguredMoney(value: string) {
  const parsedValue = parseMoneyToX100(value)

  return parsedValue !== null && parsedValue > 0
}

export function hasAnyConfiguredMoney(
  values: CustomerFormValues,
  fields: ProcessingFeeField[],
) {
  return fields.some((field) => hasConfiguredMoney(values[field.key]))
}

export function parseProcessingFeeValues(values: CustomerFormValues) {
  return Object.fromEntries(
    allProcessingFeeFields.map((field) => [
      field.key,
      parseMoneyToX100(values[field.key]),
    ]),
  ) as Partial<Record<ProcessingFeeFormKey, number | null>>
}

export function getProcessingFeeValue(
  customer: Customer,
  category: ProcessingCategory,
  pricingTaxIncluded: boolean,
  special = false,
) {
  const toCustomerMoneyKey = (key: ProcessingFeeFormKey) =>
    `${key}X100` as keyof Customer

  if (special) {
    if (pricingTaxIncluded) {
      return customer[
        toCustomerMoneyKey(processingFeeKeys[category].specialIncluded)
      ] as number
    }

    return customer[
      toCustomerMoneyKey(processingFeeKeys[category].specialExcluded)
    ] as number
  }

  if (pricingTaxIncluded) {
    return customer[toCustomerMoneyKey(processingFeeKeys[category].included)] as number
  }

  return customer[toCustomerMoneyKey(processingFeeKeys[category].excluded)] as number
}

export function getProcessingFeeValues(
  customer: Customer,
  pricingTaxIncluded: boolean,
  special = false,
) {
  return processingCategories.map((category) => ({
    category: category.label,
    value: getProcessingFeeValue(
      customer,
      category.key,
      pricingTaxIncluded,
      special,
    ),
  }))
}

function formKeyToPayloadKey(key: ProcessingFeeFormKey) {
  return `${key}X100` as keyof CustomerFormPayload
}

function formKeyToCustomerKey(key: ProcessingFeeFormKey) {
  return `${key}X100` as keyof Customer
}

export function buildProcessingFeeExportHeaders(
  groupLabel: string,
  fields: Array<{ label: string }>,
) {
  return fields.map((field) => `${groupLabel}${field.label}加工费`)
}

export function buildProcessingFeeExportValues(
  customer: Customer,
  fields: Array<{ key: ProcessingFeeFormKey }>,
) {
  return fields.map((field) =>
    formatPlainMoneyX100(customer[formKeyToCustomerKey(field.key)] as number),
  )
}

export function buildMoneyPayload(
  parsedFees: Partial<Record<ProcessingFeeFormKey, number | null>>,
) {
  return Object.values(processingFeeKeys).reduce(
    (payload, keys) => {
      for (const key of Object.values(keys)) {
        payload[formKeyToPayloadKey(key)] = parsedFees[key] ?? 0
      }

      return payload
    },
    {} as Record<string, number>,
  ) as Partial<CustomerFormPayload>
}

export function getDefaultPricingLabel(value: DefaultPricingTaxIncluded) {
  if (value === "included") {
    return "含税"
  }

  if (value === "excluded") {
    return "不含税"
  }

  return "请先填写加工费"
}

export function resolveDefaultPricing(
  current: DefaultPricingTaxIncluded,
  hasIncludedPrice: boolean,
  hasExcludedPrice: boolean,
): { error?: string; value: DefaultPricingTaxIncluded } {
  const selectedPriceCleared =
    (current === "included" && !hasIncludedPrice) ||
    (current === "excluded" && !hasExcludedPrice)

  if (selectedPriceCleared) {
    return {
      error: "默认计价对应的加工费已清空，请重新选择",
      value: "",
    }
  }

  if (!current && hasIncludedPrice !== hasExcludedPrice) {
    return {
      error: undefined,
      value: hasIncludedPrice ? "included" : "excluded",
    }
  }

  return { error: undefined, value: current }
}

export function getDefaultProcessingFees(customer: Customer) {
  return getProcessingFeeValues(customer, customer.defaultPricingTaxIncluded).filter(
    (fee) => fee.value > 0,
  )
}

export function getSpecialProcessingFees(customer: Customer) {
  if (!customer.specialPricingKeyword.trim()) {
    return []
  }

  return getProcessingFeeValues(
    customer,
    customer.defaultPricingTaxIncluded,
    true,
  ).filter((fee) => fee.value > 0)
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    customerAddress: customer.customerAddress,
    customerName: customer.customerName,
    defaultPricingTaxIncluded: customer.defaultPricingTaxIncluded
      ? "included"
      : "excluded",
    phone: customer.phone,
    bridgeProcessingFeeTaxExcluded: formatMoneyInput(
      customer.bridgeProcessingFeeTaxExcludedX100,
    ),
    powderProcessingFeeTaxExcluded: formatMoneyInput(
      customer.powderProcessingFeeTaxExcludedX100,
    ),
    billetProcessingFeeTaxExcluded: formatMoneyInput(
      customer.billetProcessingFeeTaxExcludedX100,
    ),
    oxidationProcessingFeeTaxExcluded: formatMoneyInput(
      customer.oxidationProcessingFeeTaxExcludedX100,
    ),
    electrophoresisProcessingFeeTaxExcluded: formatMoneyInput(
      customer.electrophoresisProcessingFeeTaxExcludedX100,
    ),
    bridgeProcessingFeeTaxIncluded: formatMoneyInput(
      customer.bridgeProcessingFeeTaxIncludedX100,
    ),
    powderProcessingFeeTaxIncluded: formatMoneyInput(
      customer.powderProcessingFeeTaxIncludedX100,
    ),
    billetProcessingFeeTaxIncluded: formatMoneyInput(
      customer.billetProcessingFeeTaxIncludedX100,
    ),
    oxidationProcessingFeeTaxIncluded: formatMoneyInput(
      customer.oxidationProcessingFeeTaxIncludedX100,
    ),
    electrophoresisProcessingFeeTaxIncluded: formatMoneyInput(
      customer.electrophoresisProcessingFeeTaxIncludedX100,
    ),
    specialPricingKeyword: customer.specialPricingKeyword,
    specialBridgeProcessingFeeTaxIncluded: formatMoneyInput(
      customer.specialBridgeProcessingFeeTaxIncludedX100,
    ),
    specialPowderProcessingFeeTaxIncluded: formatMoneyInput(
      customer.specialPowderProcessingFeeTaxIncludedX100,
    ),
    specialBilletProcessingFeeTaxIncluded: formatMoneyInput(
      customer.specialBilletProcessingFeeTaxIncludedX100,
    ),
    specialOxidationProcessingFeeTaxIncluded: formatMoneyInput(
      customer.specialOxidationProcessingFeeTaxIncludedX100,
    ),
    specialElectrophoresisProcessingFeeTaxIncluded: formatMoneyInput(
      customer.specialElectrophoresisProcessingFeeTaxIncludedX100,
    ),
    specialBridgeProcessingFeeTaxExcluded: formatMoneyInput(
      customer.specialBridgeProcessingFeeTaxExcludedX100,
    ),
    specialPowderProcessingFeeTaxExcluded: formatMoneyInput(
      customer.specialPowderProcessingFeeTaxExcludedX100,
    ),
    specialBilletProcessingFeeTaxExcluded: formatMoneyInput(
      customer.specialBilletProcessingFeeTaxExcludedX100,
    ),
    specialOxidationProcessingFeeTaxExcluded: formatMoneyInput(
      customer.specialOxidationProcessingFeeTaxExcludedX100,
    ),
    specialElectrophoresisProcessingFeeTaxExcluded: formatMoneyInput(
      customer.specialElectrophoresisProcessingFeeTaxExcludedX100,
    ),
  }
}
