import { api } from "./api";
import { authContext } from "./auth";
import { invoiceDownload } from "./invoice-workspace";

export type OrderLabelUrl = {
  parcelId?: string;
  parcelCode?: string;
  pieceNo?: number;
  pieceTotal?: number;
  url: string;
};

/** Get secure label PDF URL */
export async function getLabelUrl(orderId: string) {
  const res = await api.get(`/api/labels/orders/${orderId}/url`);
  return res.data.url;
}

/** Get secure label PDF URLs (one per parcel when available) */
export async function getOrderLabelUrls(orderId: string): Promise<{
  url: string;
  urls: OrderLabelUrl[];
}> {
  const res = await api.get(`/api/labels/orders/${orderId}/url`);

  const firstUrl: string = res.data?.url;
  const urls: OrderLabelUrl[] = Array.isArray(res.data?.urls)
    ? res.data.urls
    : firstUrl
      ? [{ url: firstUrl }]
      : [];

  return { url: firstUrl, urls };
}

/** Get secure invoice PDF URL */
export async function getInvoiceUrl(orderId: string) {
  const context = authContext();
  if (!context) throw Error("Selected company required");
  return invoiceDownload(context, orderId);
}
