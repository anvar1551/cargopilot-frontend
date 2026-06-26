import { hasPermission, type AuthUser } from "@/lib/auth";

export type OrderActionCapabilities = {
  canOpenDetails: boolean;
  canSelect: boolean;
  canAssignDriver: boolean;
  canChangeStatus: boolean;
  canBookCarrier: boolean;
  canReadPayments: boolean;
  canRetryPayment: boolean;
  canSettleCash: boolean;
  canHandleWarehouseCash: boolean;
  canDelete: boolean;
  canExport: boolean;
};

export const READ_ONLY_ORDER_CAPABILITIES: OrderActionCapabilities = {
  canOpenDetails: true,
  canSelect: false,
  canAssignDriver: false,
  canChangeStatus: false,
  canBookCarrier: false,
  canReadPayments: false,
  canRetryPayment: false,
  canSettleCash: false,
  canHandleWarehouseCash: false,
  canDelete: false,
  canExport: false,
};

export function getErpOrderCapabilities(user: AuthUser | null | undefined): OrderActionCapabilities {
  return {
    canOpenDetails: hasPermission(user, "shipment.view"),
    canSelect:
      hasPermission(user, "shipment.assignCourier") ||
      hasPermission(user, "shipment.changeStatus"),
    canAssignDriver: hasPermission(user, "shipment.assignCourier"),
    canChangeStatus: hasPermission(user, "shipment.changeStatus"),
    canBookCarrier: hasPermission(user, "shipment.bookCarrier"),
    canReadPayments:
      hasPermission(user, "payments.intents.read") ||
      hasPermission(user, "finance.viewLedger"),
    canRetryPayment: hasPermission(user, "payments.intents.create"),
    canSettleCash: hasPermission(user, "finance.settleCash"),
    canHandleWarehouseCash:
      hasPermission(user, "warehouse.scanIn") ||
      hasPermission(user, "warehouse.scanOut") ||
      hasPermission(user, "finance.settleCash"),
    canDelete: hasPermission(user, "shipment.delete"),
    canExport: hasPermission(user, "shipment.export"),
  };
}

export function getWarehouseOrderCapabilities(user: AuthUser | null | undefined): OrderActionCapabilities {
  return {
    ...READ_ONLY_ORDER_CAPABILITIES,
    canSelect:
      hasPermission(user, "shipment.assignCourier") ||
      hasPermission(user, "shipment.changeStatus") ||
      hasPermission(user, "warehouse.scanIn") ||
      hasPermission(user, "warehouse.scanOut"),
    canAssignDriver: hasPermission(user, "shipment.assignCourier"),
    canChangeStatus:
      hasPermission(user, "shipment.changeStatus") ||
      hasPermission(user, "warehouse.scanIn") ||
      hasPermission(user, "warehouse.scanOut"),
    canBookCarrier: false,
    canReadPayments: false,
    canRetryPayment: false,
    canSettleCash: false,
    canHandleWarehouseCash:
      hasPermission(user, "warehouse.scanIn") ||
      hasPermission(user, "warehouse.scanOut"),
    canDelete: false,
    canExport: hasPermission(user, "shipment.export"),
  };
}
