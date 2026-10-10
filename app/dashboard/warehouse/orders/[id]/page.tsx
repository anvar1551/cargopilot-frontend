"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
/** Preserve bookmarks without mounting the retired warehouse execution surface. */
export default function WarehouseOrderDetailsPage() {
  const { id } = useParams<{ id: string }>(),
    router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/warehouse?custody=" + encodeURIComponent(id));
  }, [id, router]);
  return (
    <p role="status" className="p-6">
      Opening authorized custody preflight…
    </p>
  );
}
