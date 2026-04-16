# Pickup Point + Pricing Implementation Plan

This rollout keeps the current CargoPilot warehouse and order flow stable while we add:

1. real shipment service types
2. pickup-point-capable warehouse operations
3. client-managed pricing regions, zone matrix, and tariff plans

## Phase 1: Normalize Service Type

Goal:
- Replace the current mixed `serviceType` usage with the real logistics flow model.

Service types:
- `DOOR_TO_DOOR`
- `DOOR_TO_POINT`
- `POINT_TO_DOOR`
- `POINT_TO_POINT`

Tasks:
- Backend: add `ServiceType` enum to Prisma schema
- Backend: normalize legacy values (`EXPRESS`, `SAME_DAY`, `ECONOMY`) into safe flow defaults during transition
- Backend: validate order create/import payloads against normalized service types
- Frontend: replace shipment-step dropdown values
- Frontend: update service type labels in EN/RU/UZ
- Frontend: display formatted service types in review/details views

## Phase 2: Extend Warehouse for Pickup Points

Goal:
- Reuse the current warehouse foundation without introducing a new route or role.

Warehouse additions:
- `type = warehouse | pickup_point`
- `supportsCustomerPickup`
- `supportsCustomerDropoff`
- `supportsLocalDispatch`

Tasks:
- Backend: extend warehouse schema and APIs
- Frontend: extend `lib/warehouses.ts`
- Frontend: make `/dashboard/warehouse` mode-aware
- Frontend: reuse `DispatchCenter` with capability-driven behavior

## Phase 3: Add Pickup-Point Operational Data to Orders

Goal:
- Support self-pickup/dropoff operations safely.

Order additions:
- `storageLocation`
- `pickupReadyAt`
- `pickupCollectedAt`
- `pickupNotifiedAt`

Tasks:
- Backend: add fields and expose them in read APIs
- Backend: add tracking events for pickup-point operations
- Frontend: show pickup-point fields in order details

## Phase 4: Pricing Master Data

Goal:
- Give managers controlled pricing configuration that applies to orders.

Master data:
- `PricingRegion`
- `ZoneMatrixEntry`
- `TariffPlan`
- `TariffBucketRate`

Tasks:
- Backend: add pricing schema
- Backend: add pricing service module
- Frontend: add manager pricing area

## Phase 5: Order Pricing Application

Goal:
- Apply configured pricing rules to orders and save the resolved result.

Order pricing snapshot:
- `originPricingRegionId`
- `destinationPricingRegionId`
- `resolvedZone`
- `pricingPlanId`
- `pricingWeightBucket`
- `calculatedBasePrice`
- `calculatedFinalPrice`

Tasks:
- Backend: calculate pricing on create/import
- Frontend: preview pricing in order creation dialog
- Backend: freeze price snapshot on order creation

## Safe rollout order

1. Phase 1 service types
2. Phase 2 warehouse type/capabilities
3. Manager warehouse configuration UI
4. Warehouse dashboard mode-awareness
5. Order pickup-point operational fields
6. Pickup queue + handover flow
7. Pricing master data
8. Order pricing integration
