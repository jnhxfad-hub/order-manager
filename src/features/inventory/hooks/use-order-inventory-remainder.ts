import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  transferOrderInventoryRemainder,
  type TransferOrderInventoryRemainderPayload,
} from "@/features/inventory/api/inventory-api";
import {
  type InventoryNotice,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils";

export interface UseOrderInventoryRemainderOptions {
  onNotice: (notice: InventoryNotice) => void;
  selectedOrderGroup: OrderInventoryGroup | undefined;
}

export function useOrderInventoryRemainder({
  onNotice,
  selectedOrderGroup,
}: UseOrderInventoryRemainderOptions) {
  const queryClient = useQueryClient();
  const [orderRemainderOpen, setOrderRemainderOpen] = useState(false);

  const transferOrderRemainderMutation = useMutation({
    mutationFn: (payload: TransferOrderInventoryRemainderPayload) =>
      transferOrderInventoryRemainder(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOrderRemainderOpen(false);
      onNotice({
        message:
          result.destination === "customer"
            ? `剩余 ${result.totalQuantity} 支已转入客户库存`
            : `剩余 ${result.totalQuantity} 支已转入公共库存`,
        tone: "success",
      });
    },
  });

  function openRemainderDialog() {
    transferOrderRemainderMutation.reset();
    setOrderRemainderOpen(true);
  }

  function transferOrderRemainder(
    destination: "public" | "customer",
    note: string,
  ) {
    if (!selectedOrderGroup) {
      return;
    }

    transferOrderRemainderMutation.mutate({
      destination,
      note,
      orderId: selectedOrderGroup.orderId,
    });
  }

  return {
    openRemainderDialog,
    orderRemainderOpen,
    setOrderRemainderOpen,
    transferOrderRemainder,
    transferOrderRemainderMutation,
  };
}
