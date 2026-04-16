import { z } from "zod";
import { DEFAULT_SERVICE_TYPE, SERVICE_TYPES } from "@/lib/orders/service-types";

export const addressSchema = z.object({
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  building: z.string().optional().nullable(),
  apartment: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  addressType: z.enum(["RESIDENTIAL", "BUSINESS"]).optional().nullable(),
});

export const parcelInputSchema = z.object({
  weightKg: z.coerce.number().positive().optional().nullable(),
  lengthCm: z.coerce.number().positive().optional().nullable(),
  widthCm: z.coerce.number().positive().optional().nullable(),
  heightCm: z.coerce.number().positive().optional().nullable(),
});

const optionalNumber = () =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;

    const num = Number(v);
    return Number.isNaN(num) ? undefined : num;
  }, z.number().optional());

export const createOrderPayloadSchema = z
  .object({
    customerEntityId: z.string().optional().nullable(),

    sender: z
      .object({
        name: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        phone2: z.string().optional().nullable(),
        phone3: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    receiver: z
      .object({
        name: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        phone2: z.string().optional().nullable(),
        phone3: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    addresses: z.object({
      senderAddressId: z.uuid().optional().nullable(),
      receiverAddressId: z.uuid().optional().nullable(),

      senderAddress: addressSchema.optional().nullable(),
      receiverAddress: addressSchema.optional().nullable(),

      pickupAddress: z.string().min(3, "Pickup address is required"),
      dropoffAddress: z.string().min(3, "Dropoff address is required"),
      destinationCity: z.string().optional().nullable(),

      // ✅ NEW (enterprise UX)
      savePickupToAddressBook: z.boolean().optional().default(false),
      saveDropoffToAddressBook: z.boolean().optional().default(false),
    }),

    shipment: z.object({
      serviceType: z
        .enum(SERVICE_TYPES)
        .optional()
        .nullable()
        .default(DEFAULT_SERVICE_TYPE),
      weightKg: optionalNumber().refine(
        (v) => v == null || v > 0,
        "Amount must be > 0",
      ),

      codEnabled: z.boolean().default(false),
      codAmount: optionalNumber().refine(
        (v) => v == null || v > 0,
        "Amount must be > 0",
      ),
      currency: z.string().optional().nullable(),

      parcels: z.array(parcelInputSchema).optional().nullable(),
      pieceTotal: optionalNumber().refine(
        (v) => v == null || v > 0,
        "Amount must be > 0",
      ),

      fragile: z.boolean().optional(),
      dangerousGoods: z.boolean().optional(),
      shipmentInsurance: z.boolean().optional(),
      itemValue: optionalNumber(),
    }),

    payment: z
      .object({
        paymentType: z
          .enum(["CASH", "CARD", "COD", "TRANSFER", "OTHER"])
          .optional()
          .nullable(),

        deliveryChargePaidBy: z
          .enum(["SENDER", "RECIPIENT", "COMPANY"])
          .optional()
          .nullable(),

        codPaidStatus: z
          .enum(["NOT_PAID", "PAID", "PARTIAL"])
          .optional()
          .nullable(),

        serviceCharge: optionalNumber(), // allow 0 for free service

        serviceChargePaidStatus: z
          .enum(["NOT_PAID", "PAID", "PARTIAL"])
          .optional()
          .nullable(),

        ifRecipientNotAvailable: z
          .enum([
            "DO_NOT_DELIVER",
            "LEAVE_AT_DOOR",
            "LEAVE_WITH_CONCIERGE",
            "CALL_SENDER",
            "RESCHEDULE",
            "RETURN_TO_SENDER",
          ])
          .optional()
          .nullable(),
      })
      .optional()
      .nullable(),

    schedule: z
      .object({
        plannedPickupAt: z.string().optional().nullable(),
        plannedDeliveryAt: z.string().optional().nullable(),
        promiseDate: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    reference: z
      .object({
        referenceId: z.string().optional().nullable(),
        shelfId: z.string().optional().nullable(),
        promoCode: z.string().optional().nullable(),
        numberOfCalls: optionalNumber(),
      })
      .optional()
      .nullable(),

    note: z.string().optional().nullable(),
    amount: optionalNumber().refine(
      (v) => v == null || v > 0,
      "Amount must be > 0",
    ),
  })
  .superRefine((v, ctx) => {
    const savePickup = v.addresses?.savePickupToAddressBook ?? false;
    const saveDropoff = v.addresses?.saveDropoffToAddressBook ?? false;

    if (savePickup) {
      const a = v.addresses?.senderAddress;
      if (!a?.city || !a?.street) {
        ctx.addIssue({
          code: "custom",
          path: ["addresses", "senderAddress"],
          message: "City + street are required when saving pickup address",
        });
      }
    }

    if (saveDropoff) {
      const a = v.addresses?.receiverAddress;
      if (!a?.city || !a?.street) {
        ctx.addIssue({
          code: "custom",
          path: ["addresses", "receiverAddress"],
          message: "City + street are required when saving dropoff address",
        });
      }
    }
  });

export type CreateOrderFormValues = z.input<typeof createOrderPayloadSchema>;
export type CreateOrderPayload = z.output<typeof createOrderPayloadSchema>;
