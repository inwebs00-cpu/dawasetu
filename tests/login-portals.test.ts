import { describe, expect, it } from "vitest";

import {
  getLoginDestination,
  isLoginPortal,
  type LoginBusiness,
} from "@/lib/auth/login-portals";

const businesses: LoginBusiness[] = [
  { business_type: "Retail Pharmacy" },
  { business_type: "Distributor / Stockist" },
];

describe("role-specific sign-in destinations", () => {
  it("keeps customer login separate from business workspaces", () => {
    expect(getLoginDestination("customer")).toBe("/account");
  });

  it("requires an assigned platform permission for the admin portal", () => {
    expect(getLoginDestination("admin", [], false)).toBeNull();
    expect(getLoginDestination("admin", [], true)).toBe("/admin");
  });

  it("routes only accounts linked to a non-distributor business to partners", () => {
    expect(getLoginDestination("partner", businesses)).toBe("/partner");
    expect(
      getLoginDestination("partner", [
        { business_type: "Distributor / Stockist" },
      ]),
    ).toBeNull();
  });

  it("routes distributor accounts to the private distributor workspace", () => {
    expect(getLoginDestination("distributor", businesses)).toBe("/distributor");
    expect(
      getLoginDestination("distributor", [
        { business_type: "Retail Pharmacy" },
      ]),
    ).toBeNull();
  });

  it("rejects unknown portal values", () => {
    expect(isLoginPortal("admin")).toBe(true);
    expect(isLoginPortal("super-admin")).toBe(false);
  });
});
