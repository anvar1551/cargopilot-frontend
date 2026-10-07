"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
/** Legacy entrypoints lead to approved staff invitations; driver provisioning is deferred. */
export default function CreateUserDialog() {
  return (
    <Button asChild variant="outline">
      <Link href="/dashboard/manager/users">Operational staff invitations</Link>
    </Button>
  );
}
