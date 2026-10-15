export const loginPortals = [
  "customer",
  "admin",
  "partner",
  "distributor",
] as const;

export type LoginPortal = (typeof loginPortals)[number];

export interface LoginBusiness {
  business_type: string;
}

export function isLoginPortal(value: string): value is LoginPortal {
  return loginPortals.some((portal) => portal === value);
}

export function getLoginDestination(
  portal: LoginPortal,
  businesses: readonly LoginBusiness[] = [],
  hasAdminAccess = false,
): string | null {
  if (portal === "customer") return "/account";
  if (portal === "admin") return hasAdminAccess ? "/admin" : null;

  const hasMatchingBusiness = businesses.some((business) => {
    const isDistributor = business.business_type
      .toLowerCase()
      .includes("distributor");
    return portal === "distributor" ? isDistributor : !isDistributor;
  });

  if (!hasMatchingBusiness) return null;
  return portal === "distributor" ? "/distributor" : "/partner";
}
