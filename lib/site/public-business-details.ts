export function getPublicBusinessDetails() {
  return {
    legalName: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Inwebs",
    address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || "",
    supportEmail:
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "dawasetuofficial@gmail.com",
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "",
    supportHours: process.env.NEXT_PUBLIC_SUPPORT_HOURS?.trim() || "",
    grievanceName: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME?.trim() || "",
    grievanceEmail:
      process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL?.trim() || "",
    grievancePhone:
      process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE?.trim() || "",
  };
}

export function hasPublicMerchantDetails() {
  const details = getPublicBusinessDetails();
  return Boolean(
    details.legalName &&
    details.address &&
    details.supportEmail &&
    details.supportPhone &&
    details.grievanceName &&
    details.grievanceEmail &&
    details.grievancePhone,
  );
}
