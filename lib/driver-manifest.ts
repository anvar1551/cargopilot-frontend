import { fetchOrderById, fetchOrders } from "@/lib/orders";
import { getStatusLabel } from "@/lib/i18n/labels";

type ManifestLabels = {
  printManifest: string;
  popupBlocked: string;
  title: string;
  subtitle: string;
  driver: string;
  warehouse: string;
  printedAt: string;
  orderCount: string;
  activeCount: string;
  customer: string;
  stop: string;
  order: string;
  status: string;
  receiver: string;
  phone: string;
  route: string;
  pieces: string;
  cod: string;
  footer: string;
  noWarehouse: string;
  noPhone: string;
  noCod: string;
  noName: string;
  unknownOrder: string;
};

type TranslateFn = (key: string) => string;

type ManifestOrderListRow = {
  id: string;
  orderNumber?: string | number | null;
  status?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

type ManifestOrderDetail = ManifestOrderListRow & {
  receiverName?: string | null;
  receiverPhone?: string | null;
  senderPhone?: string | null;
  customerEntity?: {
    name?: string | null;
    companyName?: string | null;
    phone?: string | null;
  } | null;
  codAmount?: number | null;
  currency?: string | null;
  parcels?: Array<{
    id?: string | null;
    pieceNo?: number | null;
    pieceTotal?: number | null;
    parcelCode?: string | null;
  }> | null;
};

const ACTIVE_MANIFEST_STATUSES = [
  "assigned",
  "pickup_in_progress",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "out_for_delivery",
  "exception",
  "return_in_progress",
] as const;

export const MAX_MANIFEST_ORDERS = 120;
export const EMPTY_DRIVER_MANIFEST_ERROR = "EMPTY_DRIVER_MANIFEST";
export const POPUP_BLOCKED_DRIVER_MANIFEST_ERROR = "POPUP_BLOCKED_DRIVER_MANIFEST";

export const driverManifestCopy = {
  en: {
    printManifest: "Print manifest",
    popupBlocked: "Popup blocked. Allow popups for this site and try again.",
    title: "Driver manifest",
    subtitle: "Paper backup for assigned orders",
    driver: "Driver",
    warehouse: "Warehouse",
    printedAt: "Printed at",
    orderCount: "Orders",
    activeCount: "Active queue",
    customer: "Customer",
    stop: "Stop",
    order: "Order",
    status: "Status",
    receiver: "Receiver",
    phone: "Phone",
    route: "Route",
    pieces: "Pieces",
    cod: "COD",
    footer:
      "Carry this manifest as an offline fallback. Update warehouse or driver actions in CargoPilot once the system is available again.",
    noWarehouse: "No warehouse",
    noPhone: "-",
    noCod: "-",
    noName: "-",
    unknownOrder: "Unnumbered order",
  },
  ru: {
    printManifest: "Печать манифеста",
    popupBlocked: "Браузер заблокировал окно печати. Разрешите всплывающие окна и повторите.",
    title: "Манифест водителя",
    subtitle: "Бумажный резерв назначенных заказов",
    driver: "Водитель",
    warehouse: "Склад",
    printedAt: "Напечатано",
    orderCount: "Заказы",
    activeCount: "Активная очередь",
    customer: "Клиент",
    stop: "Стоп",
    order: "Заказ",
    status: "Статус",
    receiver: "Получатель",
    phone: "Телефон",
    route: "Маршрут",
    pieces: "Места",
    cod: "Наложенный платеж",
    footer:
      "Используйте этот манифест как офлайн-резерв. Когда система снова доступна, синхронизируйте действия курьера или склада в CargoPilot.",
    noWarehouse: "Без склада",
    noPhone: "-",
    noCod: "-",
    noName: "-",
    unknownOrder: "Заказ без номера",
  },
  uz: {
    printManifest: "Manifestni chop etish",
    popupBlocked: "Brauzer chop oynasini blokladi. Sayt uchun popupga ruxsat bering va qayta urinib ko'ring.",
    title: "Haydovchi manifesti",
    subtitle: "Biriktirilgan buyurtmalar uchun qog'oz zaxira",
    driver: "Haydovchi",
    warehouse: "Ombor",
    printedAt: "Chop etilgan vaqt",
    orderCount: "Buyurtmalar",
    activeCount: "Faol navbat",
    customer: "Mijoz",
    stop: "Stop",
    order: "Buyurtma",
    status: "Holat",
    receiver: "Qabul qiluvchi",
    phone: "Telefon",
    route: "Marshrut",
    pieces: "Joylar",
    cod: "COD",
    footer:
      "Ushbu manifestni oflayn zaxira sifatida olib yuring. Tizim qayta ishlaganda CargoPilot ichida ombor yoki haydovchi harakatlarini sinxronlang.",
    noWarehouse: "Ombor biriktirilmagan",
    noPhone: "-",
    noCod: "-",
    noName: "-",
    unknownOrder: "Raqamsiz buyurtma",
  },
} as const satisfies Record<string, ManifestLabels>;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)} ${currency || ""}`.trim();
}

async function fetchDriverManifestOrders(driverId: string) {
  const rows: ManifestOrderListRow[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let truncated = false;

  while (rows.length < MAX_MANIFEST_ORDERS) {
    const res = await fetchOrders({
      assignedDriverId: driverId,
      statuses: [...ACTIVE_MANIFEST_STATUSES],
      mode: "cursor",
      limit: 80,
      cursor,
    });

    const batch = Array.isArray(res.orders) ? (res.orders as ManifestOrderListRow[]) : [];
    for (const row of batch) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
      if (rows.length >= MAX_MANIFEST_ORDERS) {
        truncated = Boolean(res.hasMore);
        break;
      }
    }

    if (!res.hasMore || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  return { rows, truncated };
}

function buildManifestHtml(args: {
  locale: string;
  labels: ManifestLabels;
  driverName: string;
  driverEmail: string;
  warehouseName?: string | null;
  orders: ManifestOrderDetail[];
  t: TranslateFn;
}) {
  const { locale, labels, driverName, driverEmail, warehouseName, orders, t } = args;
  const printedAt = new Date().toLocaleString(locale);

  const rowsHtml = orders
    .map((order, index) => {
      const pieces =
        Array.isArray(order.parcels) && order.parcels.length > 0 ? order.parcels.length : 1;
      const customerName =
        order.customerEntity?.name ||
        order.customerEntity?.companyName ||
        order.customer?.name ||
        order.customer?.email ||
        labels.noName;

      const receiver = order.receiverName || labels.noName;
      const phone =
        order.receiverPhone || order.customerEntity?.phone || order.senderPhone || labels.noPhone;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="order-cell">
              <strong>${escapeHtml(order.orderNumber || labels.unknownOrder)}</strong>
              <span>${escapeHtml(getStatusLabel(String(order.status || "unknown"), t))}</span>
            </div>
          </td>
          <td>${escapeHtml(receiver)}</td>
          <td>${escapeHtml(phone)}</td>
          <td>
            <div class="route-cell">
              <span>${escapeHtml(order.pickupAddress || "-")}</span>
              <span class="route-arrow">→</span>
              <span>${escapeHtml(order.dropoffAddress || "-")}</span>
            </div>
          </td>
          <td>${pieces}</td>
          <td>${escapeHtml(formatMoney(order.codAmount, order.currency) || labels.noCod)}</td>
          <td>${escapeHtml(customerName)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(labels.title)} - ${escapeHtml(driverName)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111827; background: #f8fafc; }
      .page { padding: 24px; }
      .sheet { background: #fff; border: 1px solid #dbe1ea; border-radius: 20px; padding: 24px; }
      .eyebrow { display:inline-block; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#475569; padding:6px 10px; border:1px solid #dbe1ea; border-radius:999px; }
      h1 { margin: 14px 0 8px; font-size: 28px; line-height: 1.1; }
      .sub { margin: 0; color:#475569; font-size:14px; }
      .meta-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:20px; }
      .meta-card { border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px; background:#f8fafc; }
      .meta-label { font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:#64748b; }
      .meta-value { margin-top:8px; font-size:18px; font-weight:600; }
      table { width:100%; border-collapse:collapse; margin-top:22px; }
      thead th { text-align:left; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#64748b; padding:12px 10px; border-bottom:1px solid #dbe1ea; }
      tbody td { padding:12px 10px; border-bottom:1px solid #eef2f7; vertical-align:top; font-size:13px; }
      .order-cell, .route-cell { display:flex; flex-direction:column; gap:4px; }
      .order-cell span, .route-cell span { color:#475569; }
      .route-arrow { font-weight:700; color:#0f172a; }
      .footer { margin-top:18px; font-size:12px; color:#475569; }
      @media print { body { background:#fff; } .page { padding:0; } .sheet { border:none; border-radius:0; padding:0; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="sheet">
        <span class="eyebrow">${escapeHtml(labels.title)}</span>
        <h1>${escapeHtml(driverName)}</h1>
        <p class="sub">${escapeHtml(labels.subtitle)}</p>
        <div class="meta-grid">
          <div class="meta-card">
            <div class="meta-label">${escapeHtml(labels.driver)}</div>
            <div class="meta-value">${escapeHtml(driverName)}</div>
            <div class="sub">${escapeHtml(driverEmail)}</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">${escapeHtml(labels.warehouse)}</div>
            <div class="meta-value">${escapeHtml(warehouseName || labels.noWarehouse)}</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">${escapeHtml(labels.orderCount)}</div>
            <div class="meta-value">${orders.length}</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">${escapeHtml(labels.printedAt)}</div>
            <div class="meta-value">${escapeHtml(printedAt)}</div>
            <div class="sub">${escapeHtml(labels.activeCount)}: ${orders.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(labels.stop)}</th>
              <th>${escapeHtml(labels.order)}</th>
              <th>${escapeHtml(labels.receiver)}</th>
              <th>${escapeHtml(labels.phone)}</th>
              <th>${escapeHtml(labels.route)}</th>
              <th>${escapeHtml(labels.pieces)}</th>
              <th>${escapeHtml(labels.cod)}</th>
              <th>${escapeHtml(labels.customer)}</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="footer">${escapeHtml(labels.footer)}</div>
      </div>
    </div>
  </body>
</html>`;
}

export async function printDriverManifest(args: {
  driverId: string;
  driverName: string;
  driverEmail: string;
  warehouseName?: string | null;
  locale: string;
  labels: ManifestLabels;
  t: TranslateFn;
}) {
  const { driverId, driverName, driverEmail, warehouseName, locale, labels, t } = args;
  const { rows, truncated } = await fetchDriverManifestOrders(driverId);

  if (rows.length === 0) {
    throw new Error(EMPTY_DRIVER_MANIFEST_ERROR);
  }

  const details = await Promise.allSettled(
    rows.map((row) => fetchOrderById(row.id) as Promise<ManifestOrderDetail>),
  );

  const resolvedOrders = rows.map((row, index) => {
    const detail = details[index];
    if (detail?.status === "fulfilled" && detail.value) {
      return { ...row, ...detail.value };
    }
    return row as ManifestOrderDetail;
  });

  const popup = window.open("", "_blank", "width=1180,height=900");
  if (!popup) {
    throw new Error(POPUP_BLOCKED_DRIVER_MANIFEST_ERROR);
  }

  const html = buildManifestHtml({
    locale,
    labels,
    driverName,
    driverEmail,
    warehouseName,
    orders: resolvedOrders,
    t,
  });

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();

  window.setTimeout(() => {
    popup.print();
  }, 250);

  return { truncated, count: resolvedOrders.length };
}
