import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import {
  executeMasterWrite,
  readMasterIntent,
  type MasterIntent,
} from "./master-write";

const nullable = z.string().max(500).nullable().optional();
const address = z.object({
  id: z.string().uuid(),
  customerEntityId: nullable,
  country: nullable,
  city: nullable,
  addressLine1: nullable,
  addressLine2: nullable,
  street: nullable,
  neighborhood: nullable,
  postalCode: nullable,
  landmark: nullable,
  building: nullable,
  floor: nullable,
  apartment: nullable,
  addressType: z.enum(["RESIDENTIAL", "BUSINESS"]).nullable().optional(),
});
const customer = z.object({
  id: z.string().uuid(),
  type: z.enum(["PERSON", "COMPANY"]),
  name: z.string(),
  email: nullable,
  phone: nullable,
  altPhone1: nullable,
  altPhone2: nullable,
  companyName: nullable,
  taxId: nullable,
  createdAt: z.string(),
  defaultAddressId: nullable,
  defaultAddress: address.nullable().optional(),
  _count: z
    .object({ orders: z.number(), users: z.number(), addresses: z.number() })
    .optional(),
});
export type WorkspaceCustomer = z.infer<typeof customer>;
export type WorkspaceAddress = z.infer<typeof address>;
export const customerInput = z
  .object({
    type: z.enum(["PERSON", "COMPANY"]),
    name: z.string().trim().min(2).max(200),
    email: z.string().trim().email().nullable(),
    phone: nullable,
    companyName: nullable,
    taxId: nullable,
    altPhone1: nullable,
    altPhone2: nullable,
  })
  .strict()
  .superRefine((v, c) => {
    if (v.type === "COMPANY")
      for (const field of ["companyName", "taxId"] as const)
        if (!v[field]?.trim())
          c.addIssue({
            code: "custom",
            path: [field],
            message: "Required for companies",
          });
  });
export const addressInput = z
  .object({
    country: z.string().trim().min(2).max(100),
    city: z.string().trim().min(1).max(150),
    addressLine1: z.string().trim().min(1).max(300),
    addressLine2: nullable,
    postalCode: nullable,
    landmark: nullable,
    addressType: z.enum(["RESIDENTIAL", "BUSINESS"]),
  })
  .strict();
function guard(context: string, epoch: string) {
  if (!context || authContext() !== context || authEpoch() !== epoch)
    throw Error("Session changed; request suppressed");
}
async function read<T>(
  context: string,
  path: string,
  schema: z.ZodType<T>,
  params?: object,
  signal?: AbortSignal,
) {
  const epoch = authEpoch();
  guard(context, epoch);
  const result = await api.get(path, { params, signal });
  guard(context, epoch);
  return schema.parse(result.data);
}
export function listWorkspaceCustomers(
  context: string,
  params: { q: string; type?: "PERSON" | "COMPANY"; page: number },
  signal?: AbortSignal,
) {
  return read(
    context,
    "/api/customers",
    z.object({
      data: z.array(customer).max(20),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pageCount: z.number(),
    }),
    { ...params, limit: 20 },
    signal,
  );
}
export function readWorkspaceCustomer(
  context: string,
  id: string,
  signal?: AbortSignal,
) {
  return read(
    context,
    `/api/customers/${z.string().uuid().parse(id)}`,
    customer,
    undefined,
    signal,
  );
}
export async function listWorkspaceAddresses(
  context: string,
  customerId: string,
  q: string,
  signal?: AbortSignal,
) {
  const rows = await read(
    context,
    "/api/addresses",
    z.array(address).max(50),
    { customerEntityId: z.string().uuid().parse(customerId), q, take: 50 },
    signal,
  );
  if (rows.some((r) => r.customerEntityId !== customerId))
    throw Error("Address relationship mismatch");
  return rows;
}
function intentKey(context: string) {
  if (!context) throw Error("Bound login required");
  return `cp_customer_intent_v1:${encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin))}:${encodeURIComponent(context)}`;
}
export function pendingCustomerIntent(context: string) {
  const intent = readMasterIntent(
    window.localStorage.getItem(intentKey(context)),
  );
  if (intent && intent.context !== context)
    throw Error("Recovery context mismatch");
  return intent;
}
export function dismissCustomerIntent(context: string) {
  const r = pendingCustomerIntent(context);
  if (r && !["confirmed", "rejected"].includes(r.state))
    throw Error("Uncertain work cannot be discarded or replayed");
  window.localStorage.removeItem(intentKey(context));
  if (pendingCustomerIntent(context)) throw Error("Local storage unavailable");
}
export async function writeCustomerWorkspace(
  context: string,
  input: Pick<MasterIntent, "path" | "method" | "body">,
) {
  const epoch = authEpoch();
  guard(context, epoch);
  const customerPath = /^\/api\/customers\/[0-9a-f-]{36}$/i.test(input.path);
  const addressPath = /^\/api\/addresses\/[0-9a-f-]{36}$/i.test(input.path);
  if (customerPath || addressPath)
    z.string().uuid().parse(input.path.split("/").pop());
  let body: unknown;
  if (input.method === "POST" && input.path === "/api/customers")
    body = customerInput.parse(input.body);
  else if (input.method === "POST" && input.path === "/api/addresses")
    body = addressInput
      .extend({ customerEntityId: z.string().uuid(), isSaved: z.literal(true) })
      .parse(input.body);
  else if (input.method === "PATCH" && customerPath)
    body = z
      .union([
        customerInput,
        z.object({ defaultAddressId: z.string().uuid().nullable() }).strict(),
      ])
      .parse(input.body);
  else if (input.method === "PATCH" && addressPath)
    body = addressInput.parse(input.body);
  else if (
    input.method === "DELETE" &&
    (customerPath || addressPath) &&
    input.body === undefined
  )
    body = undefined;
  else throw Error("Unsupported master-data action");
  if (!navigator.locks)
    throw Error(
      "This browser cannot safely serialize local changes. Use a current supported browser.",
    );
  return executeMasterWrite(
    { ...input, body },
    {
      context: authContext,
      epoch: authEpoch,
      id: () => crypto.randomUUID(),
      read: () => window.localStorage.getItem(intentKey(context)),
      write: (value) => window.localStorage.setItem(intentKey(context), value),
      lock: async (work) =>
        await navigator.locks.request(
          intentKey(context),
          { ifAvailable: true },
          async (lock) => {
            if (!lock) throw Error("Another tab is saving a record");
            return await work();
          },
        ),
      send: async (record) => {
        guard(context, epoch);
        // No automatic refresh/replay: these backend writes have no durable receipt contract.
        const response = await api.request({
          url: record.path,
          method: record.method,
          data: record.body,
          timeout: 15_000,
          noReplay: true,
        } as Parameters<typeof api.request>[0]);
        guard(context, epoch);
        const id =
          record.method === "DELETE"
            ? record.path.split("/").pop()
            : response.data?.id;
        return { id: z.string().uuid().parse(id) };
      },
    },
  );
}
