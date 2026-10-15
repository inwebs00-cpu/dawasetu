export const ADMIN_LOGIN_EMAIL = "dawasetuofficial@gmail.com";
export const ADMIN_LOGIN_ID = "projectmed";

export function resolveAdminLoginEmail(identifier: string): string | null {
  const normalized = identifier.trim().toLowerCase();
  if (normalized === ADMIN_LOGIN_ID) return ADMIN_LOGIN_EMAIL;
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}
