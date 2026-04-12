# Dispatch Enterprise Solution (Pickup vs Delivery Cycles)

## Goal
Support both `manager` and `warehouse` users to:
- assign drivers in bulk,
- dispatch in bulk,
- operate separate pickup and delivery cycles safely.

Keep order lifecycle clean and role-based while remaining backward-compatible with existing status flow.

## Phase 1 (Fast rollout, minimal schema)

### 1) API Contracts

#### `PATCH /api/orders/assign-driver-bulk`
Auth: `manager`, `warehouse`

Request:
```json
{
  "orderIds": ["uuid-1", "uuid-2"],
  "driverId": "uuid-driver",
  "cycle": "pickup"
}
```

`cycle` enum:
- `pickup`
- `delivery`
- `linehaul`

Response:
```json
{
  "success": true,
  "count": 2,
  "orders": [],
  "rejected": [
    {
      "orderId": "uuid-x",
      "reason": "STATUS_NOT_ASSIGNABLE_FOR_CYCLE",
      "status": "at_warehouse"
    }
  ]
}
```

Rules:
- Warehouse user may assign only orders in their own warehouse scope.
- `pickup` assignable statuses: `pending`, `assigned`, `exception`.
- `delivery` assignable statuses: `at_warehouse`, `out_for_delivery`, `exception`.
- `linehaul` assignable statuses: `at_warehouse`, `in_transit`, `exception`.
- Do not force order status to `assigned` for delivery/linehaul cycle reassignment.
- Create tracking event: `DRIVER_ASSIGNED` with `note` including cycle.

#### `PATCH /api/orders/dispatch-bulk`
Auth: `manager`, `warehouse`

Request:
```json
{
  "orderIds": ["uuid-1", "uuid-2"],
  "cycle": "delivery",
  "warehouseId": "uuid-warehouse-optional-for-manager"
}
```

Response:
```json
{
  "success": true,
  "count": 2,
  "orders": [],
  "rejected": []
}
```

Rules:
- Requires driver assigned on each order.
- Warehouse users cannot override warehouse; token warehouse is used.
- Status updates by cycle:
  - `pickup` dispatch: keep `assigned` (driver starts via `PICKUP_STARTED`).
  - `delivery` dispatch: set `out_for_delivery`.
  - `linehaul` dispatch: set `in_transit`.
- Write tracking with cycle-specific note and warehouse context.

### 2) Backend role updates
- Allow route access:
  - `assign-driver-bulk`: manager + warehouse.
  - new `dispatch-bulk`: manager + warehouse.
- Keep `status-bulk` manager-only for now (safer).

### 3) Frontend behavior
- In Dispatch Center, require choosing cycle first.
- Batch mode switch:
  - `Assign` (needs driver + cycle)
  - `Dispatch` (needs cycle, no driver change)
- Show disabled reason on each blocked order:
  - wrong status for cycle
  - no assigned driver (dispatch)
  - different warehouse
  - final status (`delivered`, `returned`, `cancelled`)

## Phase 2 (Enterprise clean model)

### 1) Prisma additions

```prisma
enum TaskType {
  pickup
  linehaul
  delivery
}

enum TaskStatus {
  queued
  assigned
  dispatched
  in_progress
  completed
  failed
  cancelled
}

model OrderTask {
  id             String     @id @default(uuid()) @db.Uuid
  orderId         String     @db.Uuid
  type            TaskType
  sequence        Int
  status          TaskStatus @default(queued)

  warehouseId     String?    @db.Uuid
  driverId        String?    @db.Uuid

  assignedById    String?    @db.Uuid
  assignedAt      DateTime?
  dispatchedById  String?    @db.Uuid
  dispatchedAt    DateTime?

  startedAt       DateTime?
  completedAt     DateTime?
  failedAt        DateTime?

  reasonCode      ReasonCode?
  note            String?

  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  order           Order      @relation(fields: [orderId], references: [id])
  warehouse       Warehouse? @relation(fields: [warehouseId], references: [id])
  driver          User?      @relation("OrderTaskDriver", fields: [driverId], references: [id])
  assignedBy      User?      @relation("OrderTaskAssignedBy", fields: [assignedById], references: [id])
  dispatchedBy    User?      @relation("OrderTaskDispatchedBy", fields: [dispatchedById], references: [id])

  @@index([orderId, type, status])
  @@index([warehouseId, type, status])
  @@index([driverId, status])
}
```

User relations:
```prisma
model User {
  // ...
  taskDriver       OrderTask[] @relation("OrderTaskDriver")
  taskAssignedBy   OrderTask[] @relation("OrderTaskAssignedBy")
  taskDispatchedBy OrderTask[] @relation("OrderTaskDispatchedBy")
}
```

Order relation:
```prisma
model Order {
  // ...
  tasks OrderTask[]
}
```

### 2) Task-first API
- `POST /api/orders/tasks/assign-bulk`
- `POST /api/orders/tasks/dispatch-bulk`
- `POST /api/orders/tasks/:taskId/start`
- `POST /api/orders/tasks/:taskId/complete`
- `POST /api/orders/tasks/:taskId/fail`

Order status is derived from task progression instead of direct ad-hoc transitions.

## Role matrix (target)
- `manager`: assign/dispatch/start/override all.
- `warehouse`: assign/dispatch tasks in own warehouse; cannot cross warehouse boundaries.
- `driver`: start/complete/fail only own assigned task.
- `customer`: read only.

## Recommended sequence
1. Implement Phase 1 API additions and FE cycle selector.
2. Stabilize operations for 1-2 weeks with logs and rejected-reason analytics.
3. Implement `OrderTask` model (Phase 2) and migrate assignment/dispatch logic.
4. Make dashboard metrics task-based (pickup SLA, dispatch SLA, delivery SLA).

