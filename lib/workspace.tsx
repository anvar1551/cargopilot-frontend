"use client";
import { useSyncExternalStore } from "react";
import { authContext, authEpoch, getUser, subscribeAuth } from "./auth";

export function useWorkspaceSession() {
  const epoch = useSyncExternalStore(subscribeAuth, authEpoch, () => "server");
  const user = epoch === "server" ? null : getUser();
  return { user, context: user ? authContext() : null, epoch };
}

export function workspaceError(error: unknown) {
  const e = error as { response?: { status?: number }; message?: string };
  if (
    e.message?.includes("Session changed") ||
    e.message?.includes("Bound login")
  )
    return "Your session changed. Sign in again before continuing.";
  if (e.response?.status === 403)
    return "Your selected membership cannot perform this action. Access may have changed.";
  if (e.response?.status === 404)
    return "This record is unavailable in your selected context.";
  if (e.response?.status === 409)
    return "The record is in use or its state changed. Refresh before starting a new action.";
  if (e.response?.status === 400 || e.response?.status === 422)
    return "The request was rejected. Check the required fields.";
  return "We could not confirm the result. Refresh the records; do not repeat an uncertain write.";
}
