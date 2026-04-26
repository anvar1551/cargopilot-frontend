# CargoPilot Maps + Realtime + Proof Blueprint

Date: April 22, 2026  
Owner: Solo build (Anvar + Codex)

## 1. Product goal
- Make location workflows faster than competitors.
- Make manager decisions map-first, not table-first.
- Add legally stronger delivery confirmation via signature + photo.

## 2. Performance budgets (non-negotiable)
- Manager live map first paint: `p95 < 1.2s`.
- Live driver movement latency (driver -> manager UI): `p95 < 800ms`.
- Order create map pick + reverse geocode: `p95 < 1.5s` cold, `< 500ms` cached.
- Batch status update UI action ack: `p95 < 300ms`.
- Websocket reconnect recovery: `< 3s`.

## 3. Feature scope
### A. Map picker in order creation
- Open map modal from pickup/dropoff fields.
- Click map -> resolve address -> prefill structured fields.
- Keep manual edits possible after autofill.
- Save text address now; coordinate persistence added in backend phase.

### B. Live operations map (manager)
- Driver markers with status color and stale-signal badge.
- Optional order markers and nearest-driver helper.
- Filter by warehouse, status, region.

### C. Heatmaps
- Pickup demand heatmap.
- Dropoff demand heatmap.
- Delay/exception hotspots.

### D. Delivery proof (POD)
- Driver uploads:
  - signature (drawn on phone),
  - photo proof.
- Files saved to S3 with typed metadata in DB.
- Order details tab shows latest POD assets clearly.

## 4. Architecture
### Frontend
- Next.js client map components with lazy mount.
- React Query for initial snapshots.
- WebSocket for delta events.
- Marker clustering + viewport-only rendering.

### Backend
- Location ingest endpoint (driver GPS writes).
- WebSocket gateway (tenant/warehouse scoped rooms).
- Geocoding + routing integration.
- POD upload APIs (presigned upload or direct multipart flow).

### Data
- Postgres (+ PostGIS recommended) for geo filters and historical queries.
- Redis for hot live locations and fanout efficiency.
- S3 for POD media and labels.

## 5. Event contracts (WebSocket)
- `driver.location.updated`
  - `driverId, lat, lng, heading, speed, accuracyM, recordedAt, seqNo`
- `order.status.updated`
  - `orderId, status, updatedAt, driverId?`
- `order.assignment.updated`
  - `orderId, driverId, assignedAt`
- `driver.presence.updated`
  - `driverId, online, lastSeenAt`
- `order.proof.added`
  - `orderId, type(signature|photo), fileKey, createdAt, actorId`

Rules:
- Include `seqNo` for ordering.
- Idempotent handling by `driverId + seqNo`.
- Fallback polling every 30-60s when socket disconnected.

## 6. Data model additions (backend phase)
- `orders`
  - `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng`
  - `pickup_geocode_conf`, `dropoff_geocode_conf`
- `driver_locations_current`
  - one row per driver (latest state)
- `driver_locations_history`
  - append-only, partition by date
- `order_proofs`
  - `id, order_id, type, s3_key, mime_type, size, created_by, created_at`

## 7. POD storage strategy
- Store binary in S3, metadata in DB.
- Recommended lifecycle:
  - hot proof files 90 days standard,
  - move older to cheaper storage class.
- Background cleanup for orphaned uploads.

## 8. Security and compliance
- RBAC for viewing live location and proofs.
- Signed URLs for private proof files.
- Audit trail for proof upload/delete/view.
- Retention policy configurable per client.

## 9. Implementation phases (solo-friendly)
1. Phase 1 (now): map picker in create order UI + env wiring.
2. Phase 2: backend coordinate fields + persist selected coordinates.
3. Phase 3: manager live map page with mocked stream + then real websocket.
4. Phase 4: driver location ingest + full realtime wiring.
5. Phase 5: POD upload APIs + signature/photo UI in order details.
6. Phase 6: heatmap aggregates + performance hardening.

## 10. Current status
- Phase 1 started in frontend:
  - Mapbox dependency added.
  - Map picker modal integrated into order create pickup/dropoff.
  - Reverse geocode autofill wired into structured address fields.
  - `NEXT_PUBLIC_MAPBOX_TOKEN` env key added to docker env templates.
