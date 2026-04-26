export type ReverseGeocodeAddress = {
  formattedAddress: string;
  country: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  postalCode: string | null;
};

export type ForwardGeocodeAddress = ReverseGeocodeAddress & {
  lat: number;
  lng: number;
};

export const MAPBOX_DEFAULT_CENTER = {
  lng: 69.2401,
  lat: 41.2995,
  zoom: 10,
} as const;

export function getMapboxToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
}

export function isMapboxConfigured() {
  return Boolean(getMapboxToken());
}

type MapboxFeature = {
  id?: string;
  text?: string;
  address?: string;
  place_name?: string;
  center?: [number, number];
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    coordinates?: {
      longitude?: number;
      latitude?: number;
    };
  };
} & {
  properties?: {
    full_address?: string;
    place_formatted?: string;
    context?: {
      country?: { name?: string; country_code?: string };
      region?: { name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      district?: { name?: string };
      neighborhood?: { name?: string };
      postcode?: { name?: string };
      address?: { street_name?: string; address_number?: string };
      street?: { name?: string };
    };
  };
  context?: Array<{
    id?: string;
    text?: string;
    short_code?: string;
  }>;
};

function featureCoordinates(feature: MapboxFeature) {
  const fromGeo = feature.geometry?.coordinates;
  if (
    Array.isArray(fromGeo) &&
    typeof fromGeo[0] === "number" &&
    typeof fromGeo[1] === "number"
  ) {
    return { lng: fromGeo[0], lat: fromGeo[1] };
  }

  const fromCenter = feature.center;
  if (
    Array.isArray(fromCenter) &&
    typeof fromCenter[0] === "number" &&
    typeof fromCenter[1] === "number"
  ) {
    return { lng: fromCenter[0], lat: fromCenter[1] };
  }

  const lng = feature.properties?.coordinates?.longitude;
  const lat = feature.properties?.coordinates?.latitude;
  if (typeof lng === "number" && typeof lat === "number") {
    return { lng, lat };
  }

  return null;
}

function contextText(
  context: MapboxFeature["context"] | undefined,
  prefix: string,
) {
  return (
    context?.find((entry) => String(entry.id ?? "").startsWith(`${prefix}.`))
      ?.text ?? null
  );
}

function bestCity(feature: MapboxFeature) {
  const ctx = feature.properties?.context;
  return (
    ctx?.place?.name ??
    ctx?.locality?.name ??
    ctx?.region?.name ??
    contextText(feature.context, "place") ??
    contextText(feature.context, "locality") ??
    contextText(feature.context, "region") ??
    null
  );
}

function normalizeFeatureAddress(
  feature: MapboxFeature,
  fallbackLabel: string,
): ReverseGeocodeAddress {
  const v6Ctx = feature.properties?.context;
  const house =
    feature.properties?.context?.address?.address_number?.trim() ??
    feature.address?.trim();
  const streetName =
    feature.properties?.context?.address?.street_name?.trim() ??
    feature.properties?.context?.street?.name?.trim() ??
    feature.text?.trim() ??
    null;
  const street = house && streetName ? `${streetName} ${house}` : streetName;
  const neighborhood =
    v6Ctx?.neighborhood?.name ??
    v6Ctx?.district?.name ??
    contextText(feature.context, "neighborhood") ??
    contextText(feature.context, "district");

  return {
    formattedAddress:
      feature.properties?.full_address?.trim() ??
      feature.place_name?.trim() ??
      fallbackLabel,
    country: v6Ctx?.country?.name ?? contextText(feature.context, "country"),
    city: bestCity(feature),
    neighborhood,
    street,
    postalCode: v6Ctx?.postcode?.name ?? contextText(feature.context, "postcode"),
  };
}

function normalizeCountryCode(value?: string | null) {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  if (/^[a-z]{2}$/.test(raw)) return raw;
  return null;
}

export async function reverseGeocodeMapbox(params: {
  lng: number;
  lat: number;
  language?: string;
  countryCode?: string | null;
  signal?: AbortSignal;
}): Promise<ReverseGeocodeAddress> {
  const token = getMapboxToken();
  if (!token) {
    throw new Error("Mapbox token is not configured");
  }

  const { lng, lat, language = "en", countryCode, signal } = params;
  const baseSearch = new URLSearchParams({
    access_token: token,
    types: "address,street,neighborhood,district,locality,place,region,country,postcode",
    language,
  });

  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (normalizedCountryCode) {
    baseSearch.set("country", normalizedCountryCode);
  }

  const makeV6Url = (search: URLSearchParams) =>
    `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&${search.toString()}`;

  const makeV5Url = (search: URLSearchParams) =>
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${search.toString()}`;

  let res = await fetch(makeV6Url(baseSearch), { signal, cache: "no-store" });
  if (!res.ok && res.status === 422 && normalizedCountryCode) {
    // Retry once without country when API rejects country filter.
    const fallback = new URLSearchParams(baseSearch);
    fallback.delete("country");
    res = await fetch(makeV6Url(fallback), { signal, cache: "no-store" });
  }
  if (!res.ok) {
    // Compatibility fallback for older accounts/routes.
    res = await fetch(makeV5Url(baseSearch), { signal, cache: "no-store" });
    if (!res.ok && res.status === 422 && normalizedCountryCode) {
      const fallback = new URLSearchParams(baseSearch);
      fallback.delete("country");
      res = await fetch(makeV5Url(fallback), { signal, cache: "no-store" });
    }
  }
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);

  const data = (await res.json()) as { features?: MapboxFeature[] };
  const feature = data.features?.[0];

  if (!feature) {
    return {
      formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      country: null,
      city: null,
      neighborhood: null,
      street: null,
      postalCode: null,
    };
  }

  return normalizeFeatureAddress(feature, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
}

export async function forwardGeocodeMapbox(params: {
  query: string;
  language?: string;
  countryCode?: string | null;
  proximity?: { lng: number; lat: number } | null;
  signal?: AbortSignal;
}): Promise<ForwardGeocodeAddress | null> {
  const token = getMapboxToken();
  if (!token) return null;

  const {
    query,
    language = "en",
    countryCode,
    proximity,
    signal,
  } = params;

  const trimmed = query.trim();
  if (!trimmed) return null;

  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const baseSearch = new URLSearchParams({
    access_token: token,
    types: "address,street,neighborhood,district,locality,place,region,country,postcode",
    language,
    limit: "1",
  });

  if (normalizedCountryCode) {
    baseSearch.set("country", normalizedCountryCode);
  }
  if (proximity) {
    baseSearch.set("proximity", `${proximity.lng},${proximity.lat}`);
  }

  const encodedQuery = encodeURIComponent(trimmed);
  const makeV6Url = (search: URLSearchParams) =>
    `https://api.mapbox.com/search/geocode/v6/forward?q=${encodedQuery}&${search.toString()}`;
  const makeV5Url = (search: URLSearchParams) =>
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?${search.toString()}`;

  let res = await fetch(makeV6Url(baseSearch), { signal, cache: "no-store" });
  if (!res.ok && res.status === 422 && normalizedCountryCode) {
    const fallback = new URLSearchParams(baseSearch);
    fallback.delete("country");
    res = await fetch(makeV6Url(fallback), { signal, cache: "no-store" });
  }

  if (!res.ok) {
    res = await fetch(makeV5Url(baseSearch), { signal, cache: "no-store" });
    if (!res.ok && res.status === 422 && normalizedCountryCode) {
      const fallback = new URLSearchParams(baseSearch);
      fallback.delete("country");
      res = await fetch(makeV5Url(fallback), { signal, cache: "no-store" });
    }
  }

  if (!res.ok) {
    throw new Error(`Forward geocoding failed (${res.status})`);
  }

  const data = (await res.json()) as { features?: MapboxFeature[] };
  const feature = data.features?.[0];
  if (!feature) return null;

  const coordinates = featureCoordinates(feature);
  if (!coordinates) return null;

  return {
    ...normalizeFeatureAddress(feature, trimmed),
    lat: coordinates.lat,
    lng: coordinates.lng,
  };
}
