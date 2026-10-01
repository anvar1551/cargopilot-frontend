import { cashContext, assertCashToken } from "./cash-intent";

export type MembershipChoice = { companyMembershipId: string; companyName: string; tenantName: string };
export type SessionResponse = { token: string; refreshToken: string; user: any };
export const identityKey = cashContext;

// Local consistency only; the backend verifies signatures and eligibility.
export function validateSession(value: any, expectedContext?: string): SessionResponse {
  if (!value || typeof value.token !== "string" || !value.token ||
      typeof value.refreshToken !== "string" || !value.refreshToken) throw new Error("Invalid bound session response");
  const context = identityKey(value.user);
  assertCashToken(value.token, context);
  if (expectedContext && context !== expectedContext) throw new Error("Session context changed; fresh login required");
  return { token: value.token, refreshToken: value.refreshToken, user: value.user };
}

export function membershipChoices(error: any): MembershipChoice[] | null {
  const data = error?.response?.data;
  if (error?.response?.status !== 409 || data?.code !== "MEMBERSHIP_SELECTION_REQUIRED") return null;
  if (!Array.isArray(data.memberships) || !data.memberships.length || data.memberships.length > 1000) throw new Error("Invalid membership choices");
  const seen = new Set<string>();
  return data.memberships.map((value: any) => {
    if (!value || typeof value.companyMembershipId !== "string" || !value.companyMembershipId ||
        typeof value.companyName !== "string" || typeof value.tenantName !== "string" || seen.has(value.companyMembershipId)) {
      throw new Error("Invalid membership choices");
    }
    seen.add(value.companyMembershipId);
    return { companyMembershipId: value.companyMembershipId, companyName: value.companyName, tenantName: value.tenantName };
  });
}

export async function requestLogin(post: (path: string, body: any) => Promise<any>,
  credentials: { email: string; password: string }, choices: MembershipChoice[], selector?: string) {
  if (selector && !choices.some(choice => choice.companyMembershipId === selector)) throw new Error("Choose an eligible membership");
  try {
    const result = await post("/api/auth/login", { email: credentials.email.trim(), password: credentials.password,
      ...(selector ? { companyMembershipId: selector } : {}) });
    const session = validateSession(result.data);
    if (selector && session.user.companyMembershipId !== selector) throw new Error("Login selection mismatch");
    return { session, choices: null };
  } catch (error) {
    const eligible = membershipChoices(error);
    if (eligible) return { session: null, choices: eligible };
    // Never propagate an Axios config containing the transient password to UI/logs.
    throw new Error("Sign-in failed. Verify credentials and selected membership.");
  }
}
