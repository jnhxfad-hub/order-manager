import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import {
  getCustomerInventoryPrintSnapshot,
  listCustomerInventory,
} from "@/features/inventory/api/inventory-api";
import type { CustomerInventoryPrintCustomerOption } from "@/features/inventory/components/customer-inventory-print-dialog";
import {
  createCustomerInventoryPrintGroupLabels,
  normalizeCustomerInventoryPrintGroupLabels,
  type CustomerInventoryPrintGroupLabels,
  type CustomerInventoryPrintLayoutResult,
  type CustomerInventoryPrintPage,
} from "@/features/inventory/lib/customer-inventory-print";
import type { InventoryNotice } from "@/features/inventory/lib/inventory-utils";
import type { CustomerInventoryPrintSnapshot } from "@/features/inventory/types";
import { isTauriRuntime } from "@/lib/browser-runtime";
import { getErrorMessage } from "@/lib/errors";

export interface UseCustomerInventoryPrintOptions {
  onNotice: (notice: InventoryNotice) => void;
}

export function useCustomerInventoryPrint({
  onNotice,
}: UseCustomerInventoryPrintOptions) {
  const [customerInventoryPrintDialogOpen, setCustomerInventoryPrintDialogOpen] =
    useState(false);
  const [customerInventoryPrintCustomerId, setCustomerInventoryPrintCustomerId] =
    useState("");
  const [customerInventoryPrintPreviewOpen, setCustomerInventoryPrintPreviewOpen] =
    useState(false);
  const [customerInventoryPrintGroupOpen, setCustomerInventoryPrintGroupOpen] =
    useState(false);
  const [customerInventoryPrintGroupLabels, setCustomerInventoryPrintGroupLabels] =
    useState<CustomerInventoryPrintGroupLabels>({});
  const [customerInventoryPrintPages, setCustomerInventoryPrintPages] =
    useState<CustomerInventoryPrintPage[] | null>(null);
  const [customerInventoryPrintLayoutError, setCustomerInventoryPrintLayoutError] =
    useState<string>();
  const [currentCustomerInventoryPrintSnapshot, setCurrentCustomerInventoryPrintSnapshot] =
    useState<CustomerInventoryPrintSnapshot | null>(null);

  const handleCustomerInventoryPrintLayoutResult = useCallback(
    (result: CustomerInventoryPrintLayoutResult) => {
      if (result.errorMessage) {
        setCustomerInventoryPrintPages(null);
        setCustomerInventoryPrintLayoutError(result.errorMessage);
        setCustomerInventoryPrintPreviewOpen(false);
        setCustomerInventoryPrintGroupOpen(true);
        return;
      }

      setCustomerInventoryPrintLayoutError(undefined);
      setCustomerInventoryPrintPages(result.pages);
    },
    [],
  );

  const customerInventoryPrintOptionsQuery = useQuery({
    enabled: customerInventoryPrintDialogOpen,
    queryKey: ["customer-inventory-print-options"],
    queryFn: () => listCustomerInventory({ search: "" }),
    refetchOnMount: "always",
  });

  const getCustomerInventoryPrintSnapshotMutation = useMutation({
    mutationFn: (customerId: string) =>
      getCustomerInventoryPrintSnapshot(customerId),
    onSuccess: (snapshot) => {
      setCurrentCustomerInventoryPrintSnapshot(snapshot);
      setCustomerInventoryPrintPages(null);
      setCustomerInventoryPrintLayoutError(undefined);
      setCustomerInventoryPrintGroupLabels(
        createCustomerInventoryPrintGroupLabels(snapshot),
      );
      setCustomerInventoryPrintDialogOpen(false);
      setCustomerInventoryPrintGroupOpen(true);
    },
  });

  const customerInventoryPrintCustomers = useMemo(() => {
    const options = new Map<string, CustomerInventoryPrintCustomerOption>();

    for (const batch of customerInventoryPrintOptionsQuery.data?.batches ?? []) {
      if (batch.totalQuantity <= 0) {
        continue;
      }

      const current = options.get(batch.customerId);

      options.set(batch.customerId, {
        id: batch.customerId,
        name: batch.customerName,
        batchCount: (current?.batchCount ?? 0) + 1,
        totalQuantity: (current?.totalQuantity ?? 0) + batch.totalQuantity,
      });
    }

    return [...options.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "zh-CN"),
    );
  }, [customerInventoryPrintOptionsQuery.data?.batches]);
  useEffect(() => {
    if (
      customerInventoryPrintDialogOpen &&
      !customerInventoryPrintCustomerId &&
      customerInventoryPrintCustomers.length === 1
    ) {
      setCustomerInventoryPrintCustomerId(
        customerInventoryPrintCustomers[0]?.id ?? "",
      );
    }
  }, [
    customerInventoryPrintCustomerId,
    customerInventoryPrintCustomers,
    customerInventoryPrintDialogOpen,
  ]);

  const isCustomerInventoryPrintReady = Boolean(
    currentCustomerInventoryPrintSnapshot &&
      customerInventoryPrintPages &&
      customerInventoryPrintPreviewOpen,
  );

  function openCustomerInventoryPrintDialog() {
    getCustomerInventoryPrintSnapshotMutation.reset();
    setCustomerInventoryPrintCustomerId("");
    setCustomerInventoryPrintGroupLabels({});
    setCustomerInventoryPrintPages(null);
    setCustomerInventoryPrintLayoutError(undefined);
    setCurrentCustomerInventoryPrintSnapshot(null);
    setCustomerInventoryPrintDialogOpen(true);
  }

  function handleCustomerInventoryPrintDialogOpenChange(nextOpen: boolean) {
    setCustomerInventoryPrintDialogOpen(nextOpen);

    if (!nextOpen) {
      getCustomerInventoryPrintSnapshotMutation.reset();
    }
  }

  function submitCustomerInventoryPrint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerInventoryPrintCustomerId) {
      return;
    }

    getCustomerInventoryPrintSnapshotMutation.mutate(
      customerInventoryPrintCustomerId,
    );
  }

  function handleCustomerInventoryPrintGroupOpenChange(nextOpen: boolean) {
    setCustomerInventoryPrintGroupOpen(nextOpen);
  }

  function updateCustomerInventoryPrintGroup(
    batchId: string,
    value: string,
  ) {
    setCustomerInventoryPrintLayoutError(undefined);
    setCustomerInventoryPrintGroupLabels((current) => ({
      ...current,
      [batchId]: value,
    }));
  }

  function backToCustomerInventoryPrintCustomer() {
    setCustomerInventoryPrintGroupOpen(false);
    setCustomerInventoryPrintDialogOpen(true);
  }

  function submitCustomerInventoryPrintGroups(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!currentCustomerInventoryPrintSnapshot) {
      return;
    }

    const normalizedGroupLabels = normalizeCustomerInventoryPrintGroupLabels(
      currentCustomerInventoryPrintSnapshot,
      customerInventoryPrintGroupLabels,
    );

    setCustomerInventoryPrintGroupLabels(normalizedGroupLabels);
    setCustomerInventoryPrintPages(null);
    setCustomerInventoryPrintLayoutError(undefined);
    setCustomerInventoryPrintGroupOpen(false);
    setCustomerInventoryPrintPreviewOpen(true);
  }

  function editCustomerInventoryPrintGroups() {
    setCustomerInventoryPrintPreviewOpen(false);
    setCustomerInventoryPrintGroupOpen(true);
  }

  async function printCustomerInventory() {
    if (!currentCustomerInventoryPrintSnapshot) {
      return;
    }

    try {
      if (isTauriRuntime()) {
        await invoke("print_current_window", { orientation: "portrait" });
        return;
      }

      window.print();
    } catch (error) {
      onNotice({
        message:
          getErrorMessage(error, "无法打开打印面板") ?? "无法打开打印面板",
        tone: "warning",
      });
    }
  }
  return {
    backToCustomerInventoryPrintCustomer,
    currentCustomerInventoryPrintSnapshot,
    customerInventoryPrintCustomerId,
    customerInventoryPrintCustomers,
    customerInventoryPrintDialogOpen,
    customerInventoryPrintGroupLabels,
    customerInventoryPrintGroupOpen,
    customerInventoryPrintLayoutError,
    customerInventoryPrintOptionsQuery,
    customerInventoryPrintPages,
    customerInventoryPrintPreviewOpen,
    editCustomerInventoryPrintGroups,
    getCustomerInventoryPrintSnapshotMutation,
    handleCustomerInventoryPrintDialogOpenChange,
    handleCustomerInventoryPrintGroupOpenChange,
    handleCustomerInventoryPrintLayoutResult,
    isCustomerInventoryPrintReady,
    openCustomerInventoryPrintDialog,
    printCustomerInventory,
    setCustomerInventoryPrintCustomerId,
    setCustomerInventoryPrintPreviewOpen,
    submitCustomerInventoryPrint,
    submitCustomerInventoryPrintGroups,
    updateCustomerInventoryPrintGroup,
  };
}
