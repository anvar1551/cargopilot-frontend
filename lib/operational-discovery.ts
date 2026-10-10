import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { OPERATIONAL_PROFILES } from "./operational-intent";
const uuid = z.string().uuid();
const revision = z.enum(
  Object.keys(OPERATIONAL_PROFILES) as [
    keyof typeof OPERATIONAL_PROFILES,
    ...Array<keyof typeof OPERATIONAL_PROFILES>,
  ],
);
export const warehouseResource = z
  .object({
    id: uuid,
    name: z.string().max(200),
    location: z.string().max(1000),
    type: z.enum(["warehouse", "pickup_point"]),
  })
  .strip();
export type OperationalWarehouse = z.infer<typeof warehouseResource>;
const invitation = z
  .object({
    id: uuid,
    operationId: uuid,
    email: z.string().max(254),
    profileRevision: revision,
    warehouseIds: z.array(uuid).max(20),
    state: z.enum(["pending", "expired", "accepted", "cancelled"]),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    acceptedMembershipId: uuid.nullable(),
  })
  .strip();
const grant = z
  .object({
    membershipId: uuid,
    name: z.string().max(160),
    email: z.string().max(254),
    profileRevision: revision,
    warehouseIds: z.array(uuid).max(20),
    enabled: z.boolean(),
    managed: z.literal(true),
  })
  .strip();
export type ManagedOperationalGrant = z.infer<typeof grant>;
const ceiling = z
  .object({
    ceilingRevision: z.literal("operational-delegation.v1"),
    companyMembershipId: uuid,
    canInvite: z.boolean(),
    profiles: z
      .array(
        z
          .object({ revision, scopeKind: z.enum(["warehouse", "company"]) })
          .strip(),
      )
      .max(3),
  })
  .strip();
const schemas = {
  ceiling,
  warehouses: z
    .object({
      items: z.array(warehouseResource).max(50),
      nextCursor: z.string().max(512).nullable(),
    })
    .strip(),
  invitations: z
    .object({
      items: z.array(invitation).max(50),
      nextCursor: z.string().max(512).nullable(),
    })
    .strip(),
  grants: z
    .object({
      items: z.array(grant).max(50),
      nextCursor: z.string().max(512).nullable(),
    })
    .strip(),
};
const routes = {
  ceiling: "/api/auth/company-operational-delegation",
  warehouses: "/api/auth/company-operational-delegation/warehouses",
  invitations: "/api/auth/company-invitations",
  grants: "/api/auth/company-operational-grants",
};
export async function readOperationalDiscovery<K extends keyof typeof schemas>(
  context: string,
  kind: K,
  cursor?: string,
) {
  const epoch = authEpoch();
  if (!context || context !== authContext())
    throw Error("Selected context changed");
  const r = await api.get(routes[kind], {
    params:
      kind === "ceiling"
        ? undefined
        : {
            limit: kind === "warehouses" ? 50 : 20,
            ...(cursor ? { cursor } : {}),
          },
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Selected context changed");
  return schemas[kind].parse(r.data) as z.infer<(typeof schemas)[K]>;
}
