"use client";

import * as React from "react";
import {
  Loader2,
  LocateFixed,
  MapPinned,
  Navigation,
  Pin,
} from "lucide-react";

import {
  getMapboxToken,
  MAPBOX_DEFAULT_CENTER,
  reverseGeocodeMapbox,
  type ReverseGeocodeAddress,
} from "@/lib/mapbox";
import { cn } from "@/lib/utils";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LocationMode = "pickup" | "dropoff";

export type MapAddressSelection = ReverseGeocodeAddress & {
  lat: number;
  lng: number;
};

type Props = {
  mode: LocationMode;
  initialCountry?: string | null;
  onApply: (selection: MapAddressSelection) => void;
};

type MapClickEvent = {
  lngLat?: {
    lng?: number;
    lat?: number;
  };
};

type MapErrorEvent = {
  error?: {
    message?: string;
  } | Error;
};

type MapInstance = {
  on: {
    (event: "click", handler: (event: MapClickEvent) => void): void;
    (event: "error", handler: (event: MapErrorEvent) => void): void;
    (event: "load", handler: () => void): void;
    (event: "style.load", handler: () => void): void;
    (event: "idle", handler: () => void): void;
    (event: "render", handler: () => void): void;
  };
  resize: () => void;
  remove: () => void;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
  loaded?: () => boolean;
  isStyleLoaded?: () => boolean;
};

type MarkerInstance = {
  setLngLat: (lngLat: [number, number]) => MarkerInstance;
  addTo: (map: MapInstance) => MarkerInstance;
};

type MapboxLike = {
  accessToken: string;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
    attributionControl: boolean;
  }) => MapInstance;
  Marker: new (options: { color: string }) => MarkerInstance;
};

type LocationSelectionState = {
  lat: number;
  lng: number;
} & ReverseGeocodeAddress;

const DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";
let mapboxModulePromise: Promise<MapboxLike> | null = null;

async function loadMapboxModule(token: string) {
  if (!mapboxModulePromise) {
    mapboxModulePromise = import("mapbox-gl").then((imported) => {
      const mapbox = (imported.default ?? imported) as unknown as MapboxLike;
      return mapbox;
    });
  }
  const mapbox = await mapboxModulePromise;
  mapbox.accessToken = token;
  return mapbox;
}

export function MapAddressPickerDialog({
  mode,
  initialCountry,
  onApply,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [isResolving, setIsResolving] = React.useState(false);
  const [selection, setSelection] = React.useState<LocationSelectionState | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [mapInitError, setMapInitError] = React.useState<string | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const token = React.useMemo(() => getMapboxToken(), []);
  const [mapContainerEl, setMapContainerEl] = React.useState<HTMLDivElement | null>(
    null,
  );
  const mapRef = React.useRef<MapInstance | null>(null);
  const markerRef = React.useRef<MarkerInstance | null>(null);
  const mapboxModuleRef = React.useRef<MapboxLike | null>(null);
  const geocodeAbortRef = React.useRef<AbortController | null>(null);
  const readyFallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const mapTitle =
    mode === "pickup"
      ? t("createOrder.customer.mapPicker.pickupTitle")
      : t("createOrder.customer.mapPicker.dropoffTitle");

  const placeMarker = React.useCallback((lng: number, lat: number) => {
    if (!mapRef.current || !mapboxModuleRef.current) return;
    const mapboxgl = mapboxModuleRef.current;

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({
        color: mode === "pickup" ? "#0ea5e9" : "#14b8a6",
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [mode]);

  const resolveAddress = React.useCallback(async (lng: number, lat: number) => {
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    setIsResolving(true);
    setErrorMessage(null);

    try {
      const address = await reverseGeocodeMapbox({
        lng,
        lat,
        countryCode: initialCountry,
        signal: controller.signal,
      });

      setSelection({
        lat,
        lng,
        ...address,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("createOrder.customer.mapPicker.reverseGeocodeFailed"),
      );
      setSelection({
        lat,
        lng,
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        country: null,
        city: null,
        neighborhood: null,
        street: null,
        postalCode: null,
      });
    } finally {
      if (!controller.signal.aborted) {
        setIsResolving(false);
      }
    }
  }, [initialCountry, t]);

  const onMapClick = React.useCallback(
    (lng: number, lat: number) => {
      placeMarker(lng, lat);
      void resolveAddress(lng, lat);
    },
    [placeMarker, resolveAddress],
  );

  const mapContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    setMapContainerEl(node);
  }, []);

  const warmupMap = React.useCallback(() => {
    if (!token) return;
    void loadMapboxModule(token);
  }, [token]);

  React.useEffect(() => {
    if (!token) return;

    const runtime = globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof runtime.requestIdleCallback === "function") {
      const idleId = runtime.requestIdleCallback(() => {
        warmupMap();
      });
      return () => runtime.cancelIdleCallback?.(idleId);
    }

    const timeoutId = setTimeout(() => {
      warmupMap();
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [token, warmupMap]);

  React.useEffect(() => {
    if (!open || !token || !mapContainerEl || mapRef.current) return;

    let disposed = false;

    const init = async () => {
      try {
        const mapbox = await loadMapboxModule(token);
        if (disposed || !mapContainerEl) return;

        mapboxModuleRef.current = mapbox;
        setMapReady(false);

        const map = new mapbox.Map({
          container: mapContainerEl,
          style: DEFAULT_STYLE,
          center: [MAPBOX_DEFAULT_CENTER.lng, MAPBOX_DEFAULT_CENTER.lat],
          zoom: MAPBOX_DEFAULT_CENTER.zoom,
          attributionControl: true,
        });
        mapRef.current = map;
        setMapInitError(null);

        const markReady = () => {
          if (!disposed) {
            setMapReady(true);
          }
        };
        
        map.on("style.load", markReady);
        map.on("load", markReady);
        map.on("idle", markReady);
        map.on("render", () => {
          if ((map.loaded?.() || map.isStyleLoaded?.()) && !disposed) {
            markReady();
          }
        });

        // Safety fallback so spinner never hangs forever.
        if (readyFallbackTimerRef.current) {
          clearTimeout(readyFallbackTimerRef.current);
        }
        readyFallbackTimerRef.current = setTimeout(() => {
          if (!disposed) {
            markReady();
          }
        }, 3000);

        map.on("click", (event) => {
          const lng = event.lngLat?.lng;
          const lat = event.lngLat?.lat;
          if (typeof lng !== "number" || typeof lat !== "number") return;
          onMapClick(lng, lat);
        });
        map.on("error", (event) => {
          const msg =
            event?.error instanceof Error
              ? event.error.message
              : event?.error?.message;
          setMapInitError(msg ?? t("createOrder.customer.mapPicker.mapInitFailed"));
        });

      } catch (error) {
        if (disposed) return;
        setMapInitError(
          error instanceof Error
            ? error.message
            : t("createOrder.customer.mapPicker.mapInitFailed"),
        );
      }
    };

    void init();

    return () => {
      disposed = true;
      setMapReady(false);
      if (readyFallbackTimerRef.current) {
        clearTimeout(readyFallbackTimerRef.current);
        readyFallbackTimerRef.current = null;
      }
    };
  }, [mapContainerEl, onMapClick, open, t, token]);

  React.useEffect(() => {
    if (!open) return;
    mapRef.current?.resize();
    const t1 = setTimeout(() => mapRef.current?.resize(), 120);
    const t2 = setTimeout(() => mapRef.current?.resize(), 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) return;

    geocodeAbortRef.current?.abort();
    geocodeAbortRef.current = null;

    if (readyFallbackTimerRef.current) {
      clearTimeout(readyFallbackTimerRef.current);
      readyFallbackTimerRef.current = null;
    }

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markerRef.current = null;
    setMapReady(false);
    setMapInitError(null);
  }, [open]);

  React.useEffect(() => {
    return () => {
      geocodeAbortRef.current?.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const applySelection = () => {
    if (!selection) return;
    onApply(selection);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-xl px-3"
          onPointerEnter={warmupMap}
          onFocus={warmupMap}
        >
          <MapPinned className="mr-1 h-4 w-4" />
          {t("createOrder.customer.mapPicker.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] !max-w-5xl p-4 sm:p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Navigation className="h-4 w-4 text-muted-foreground" />
            {mapTitle}
          </DialogTitle>
          <DialogDescription>
            {t("createOrder.customer.mapPicker.description")}
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
            {t("createOrder.customer.mapPicker.tokenMissing")}
          </div>
        ) : null}
        {mapInitError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("createOrder.customer.mapPicker.mapInitFailed")}: {mapInitError}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative overflow-hidden rounded-2xl border border-border/60">
            <div
              ref={mapContainerRef}
              className={cn(
                "h-[380px] w-full bg-slate-200",
                (!token || mapInitError) && "opacity-50 grayscale",
              )}
            />
            {token && !mapInitError && !mapReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("createOrder.customer.mapPicker.loadingMap")}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">
              {t("createOrder.customer.mapPicker.clickHint")}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-border/60 bg-background p-2">
                <p className="text-muted-foreground">{t("createOrder.customer.mapPicker.latitude")}</p>
                <p className="mt-1 font-medium">
                  {selection ? selection.lat.toFixed(6) : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background p-2">
                <p className="text-muted-foreground">{t("createOrder.customer.mapPicker.longitude")}</p>
                <p className="mt-1 font-medium">
                  {selection ? selection.lng.toFixed(6) : "-"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background p-3 text-xs">
              <p className="inline-flex items-center gap-1 font-medium">
                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                {t("createOrder.customer.mapPicker.detectedAddress")}
              </p>
              <p className="mt-1 text-muted-foreground">
                {selection?.formattedAddress || "-"}
              </p>

              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>{t("createOrder.addressFields.country")}: {selection?.country || "-"}</p>
                <p>{t("createOrder.addressFields.city")}: {selection?.city || "-"}</p>
                <p>{t("createOrder.addressFields.neighborhood")}: {selection?.neighborhood || "-"}</p>
                <p>{t("createOrder.addressFields.street")}: {selection?.street || "-"}</p>
              </div>
            </div>

            {isResolving ? (
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("createOrder.customer.mapPicker.resolving")}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const lng = position.coords.longitude;
                    const lat = position.coords.latitude;
                    mapRef.current?.flyTo({ center: [lng, lat], zoom: 13 });
                    onMapClick(lng, lat);
                  },
                  () => setErrorMessage(t("createOrder.customer.mapPicker.locationDenied")),
                  { enableHighAccuracy: true, timeout: 7000 },
                );
              }
            }}
          >
            <LocateFixed className="mr-2 h-4 w-4" />
            {t("createOrder.customer.mapPicker.useMyLocation")}
          </Button>
          <Button type="button" onClick={applySelection} disabled={!selection || isResolving}>
            {t("createOrder.customer.mapPicker.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
