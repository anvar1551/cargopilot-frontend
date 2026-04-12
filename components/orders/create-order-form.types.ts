import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";

import type {
  CreateOrderFormValues,
  CreateOrderPayload,
} from "@/lib/validators/order";

export type CreateOrderFormApi = UseFormReturn<
  CreateOrderFormValues,
  unknown,
  CreateOrderPayload
>;

export type CreateOrderParcelsFieldArray = UseFieldArrayReturn<
  CreateOrderFormValues,
  "shipment.parcels",
  "id"
>;
