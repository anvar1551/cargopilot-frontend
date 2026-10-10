"use client";
import { useParams } from "next/navigation";
import CustomerWorkspace from "@/components/workspace/CustomerWorkspace";
export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  return <CustomerWorkspace customerId={id} />;
}
