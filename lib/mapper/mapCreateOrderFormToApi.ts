import type { z } from "zod";
import { createOrderPayloadSchema } from "../validators/order";

export type CreateOrderFormValues = z.infer<typeof createOrderPayloadSchema>;

// Backend expects a FLAT payload (repo CreateOrderPayload)
export type CreateOrderApiPayload = {
  pickupAddress: string;
  dropoffAddress: string;
  destinationCity?: string | null;

  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;

  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverAddress?: string | null;

  customerEntityId?: string | null;
  senderAddressId?: string | null;
  receiverAddressId?: string | null;

  serviceType?: string | null;
  codAmount?: number | null;
  currency?: string | null;
  weightKg?: number | null;

  paymentType?: string | null;
  deliveryChargePaidBy?: string | null;
  ifRecipientNotAvailable?: string | null;

  codPaidStatus?: string | null;
  serviceCharge?: number | null;
  serviceChargePaidStatus?: string | null;
  itemValue?: number | null;

  plannedPickupAt?: string | null;
  plannedDeliveryAt?: string | null;
  promiseDate?: string | null;

  referenceId?: string | null;
  shelfId?: string | null;
  promoCode?: string | null;
  numberOfCalls?: number | null;

  fragile?: boolean;
  dangerousGoods?: boolean;
  shipmentInsurance?: boolean;

  pieceTotal?: number | null;
  parcels?: Array<{
    weightKg?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
  }> | null;

  note?: string | null;

  amount?: number;
};

export function mapCreateOrderFormToApi(
  values: CreateOrderFormValues,
): CreateOrderApiPayload {
  const pickupAddress = values.addresses.pickupAddress?.trim() ?? "";
  const dropoffAddress = values.addresses.dropoffAddress?.trim() ?? "";

  // If user typed into text fields manually, we should NOT keep stale address IDs
  // (address ids only valid if they actually selected from suggestions/combobox)
  const senderAddressId = values.addresses?.senderAddressId ?? null;
  const receiverAddressId = values.addresses?.receiverAddressId ?? null;

  return {
    pickupAddress,
    dropoffAddress,
    destinationCity: values.addresses.destinationCity ?? null,

    customerEntityId: values.customerEntityId ?? null,

    senderName: values.sender?.name ?? null,
    senderPhone: values.sender?.phone ?? null,
    receiverName: values.receiver?.name ?? null,
    receiverPhone: values.receiver?.phone ?? null,

    // keep these purely optional helpers
    senderAddressId,
    receiverAddressId,

    serviceType: values.shipment?.serviceType ?? null,
    weightKg: values.shipment?.weightKg ?? null,
    codAmount: values.shipment?.codAmount ?? null,
    currency: values.shipment?.currency ?? null,

    pieceTotal: values.shipment?.pieceTotal ?? null,
    parcels: values.shipment?.parcels ?? null,

    fragile: values.shipment?.fragile ?? false,
    dangerousGoods: values.shipment?.dangerousGoods ?? false,
    shipmentInsurance: values.shipment?.shipmentInsurance ?? false,
    itemValue: values.shipment?.itemValue ?? null,

    paymentType: values.payment?.paymentType ?? null,
    deliveryChargePaidBy: values.payment?.deliveryChargePaidBy ?? null,
    ifRecipientNotAvailable: values.payment?.ifRecipientNotAvailable ?? null,
    codPaidStatus: values.payment?.codPaidStatus ?? null,
    serviceCharge: values.payment?.serviceCharge ?? null,
    serviceChargePaidStatus: values.payment?.serviceChargePaidStatus ?? null,

    plannedPickupAt: values.schedule?.plannedPickupAt ?? null,
    plannedDeliveryAt: values.schedule?.plannedDeliveryAt ?? null,
    promiseDate: values.schedule?.promiseDate ?? null,

    referenceId: values.reference?.referenceId ?? null,
    shelfId: values.reference?.shelfId ?? null,
    promoCode: values.reference?.promoCode ?? null,
    numberOfCalls: values.reference?.numberOfCalls ?? null,

    note: values.note ?? null,
    amount: values.amount,
  };
}
