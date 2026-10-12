export interface SecuritySettingsActionState {
  error?: string;
  message?: string;
}

export interface SecurityRecoveryOtpState {
  step?: "verify";
  channel?: "email" | "phone";
  identifier?: string;
  error?: string;
  message?: string;
}
