export interface AuthActionState {
  error?: string;
  message?: string;
  otpRequested?: boolean;
  confirmationRequired?: boolean;
  email?: string;
}
