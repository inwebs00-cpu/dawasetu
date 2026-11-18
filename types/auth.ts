export interface AuthActionState {
  error?: string;
  message?: string;
  otpRequested?: boolean;
  confirmationRequired?: boolean;
  passwordResetRequested?: boolean;
  passwordResetReady?: boolean;
  email?: string;
}
