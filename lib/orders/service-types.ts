export const SERVICE_TYPES = [
  "DOOR_TO_DOOR",
  "DOOR_TO_POINT",
  "POINT_TO_DOOR",
  "POINT_TO_POINT",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const DEFAULT_SERVICE_TYPE: ServiceType = "DOOR_TO_DOOR";
