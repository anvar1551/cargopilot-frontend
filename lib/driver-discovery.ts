import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { DRIVER_PROFILES } from "./driver-intent";
const uuid = z.string().uuid();
const revision = z.enum(
  Object.keys(DRIVER_PROFILES) as [
    keyof typeof DRIVER_PROFILES,
    ...Array<keyof typeof DRIVER_PROFILES>,
  ],
);
const invitation = z
  .object({
    id: uuid,
    operationId: uuid,
    email: z.string().max(254),
    profileRevision: revision,
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
    enabled: z.boolean(),
    managed: z.literal(true),
    driverType: z.enum(["local", "linehaul"]),
    activeWork: z.boolean(),
  })
  .strip();
export type ManagedDriverGrant = z.infer<typeof grant>;
const ceiling = z
  .object({
    ceilingRevision: z.literal("driver-delegation.v1"),
    companyMembershipId: uuid,
    canInvite: z.boolean(),
    profiles: z
      .array(
        z
          .object({ revision, driverType: z.enum(["local", "linehaul"]) })
          .strip(),
      )
      .max(2),
  })
  .strip();
const schemas = {
  ceiling,
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
  ceiling: "/api/auth/company-driver-delegation",
  invitations: "/api/auth/company-driver-invitations",
  grants: "/api/auth/company-driver-grants",
};
export async function readDriverDiscovery<K extends keyof typeof schemas>(
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
            limit: 20,
            ...(cursor ? { cursor } : {}),
          },
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Selected context changed");
  return schemas[kind].parse(r.data) as z.infer<(typeof schemas)[K]>;
}
