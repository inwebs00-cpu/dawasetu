"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ReactNode } from "react";

import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/(auth)/actions";
import type { AuthActionState } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthAction = (
  previousState: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

function Feedback({ state }: { state: AuthActionState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p
        role="status"
        className="rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

function Field({
  id,
  label,
  type = "text",
  name,
  autoComplete,
  minLength,
  maxLength,
  required = true,
}: {
  id: string;
  label: string;
  type?: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="grid gap-2 text-sm font-medium text-slate-800"
    >
      {label}
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
      />
    </label>
  );
}

function FormFrame({
  title,
  intro,
  action,
  submitLabel,
  children,
  footer,
}: {
  title: string;
  intro: string;
  action: AuthAction;
  submitLabel: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(15,76,78,0.35)] sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{intro}</p>
      <form action={formAction} className="mt-7 grid gap-5">
        {children}
        <Feedback state={state} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : submitLabel}
        </Button>
      </form>
      <div className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">
        {footer}
      </div>
    </section>
  );
}

export function LoginForm() {
  return (
    <FormFrame
      title="Welcome back"
      intro="Sign in to manage your DawaSetu account and partner activity."
      action={signInAction}
      submitLabel="Sign in"
      footer={
        <>
          <span>New to DawaSetu? </span>
          <Link
            className="font-semibold text-teal-800 hover:underline"
            href="/signup"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Field
        id="login-email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
      />
      <Field
        id="login-password"
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
      />
      <Link
        href="/forgot-password"
        className="-mt-2 justify-self-end text-sm font-medium text-teal-800 hover:underline"
      >
        Forgot password?
      </Link>
      <Link
        href="/security/recover"
        className="-mt-3 justify-self-end text-sm font-medium text-teal-800 hover:underline"
      >
        Forgot security PIN?
      </Link>
    </FormFrame>
  );
}

export function SignupForm() {
  return (
    <FormFrame
      title="Create your account"
      intro="Use your account to save searches and request medicine availability."
      action={signUpAction}
      submitLabel="Create account"
      footer={
        <>
          <span>Already registered? </span>
          <Link
            className="font-semibold text-teal-800 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Field
        id="signup-name"
        label="Full name"
        name="full_name"
        autoComplete="name"
        minLength={2}
        maxLength={160}
      />
      <Field
        id="signup-email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
      />
      <Field
        id="signup-password"
        label="Password (12 characters minimum)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
      />
      <p className="-mt-3 text-xs leading-5 text-slate-500">
        Your account starts with customer access. Partner access is reviewed
        separately.
      </p>
    </FormFrame>
  );
}

export function ForgotPasswordForm() {
  return (
    <FormFrame
      title="Reset your password"
      intro="Enter your account email. If it matches an account, we’ll send a secure reset link."
      action={requestPasswordResetAction}
      submitLabel="Send reset link"
      footer={
        <Link
          className="font-semibold text-teal-800 hover:underline"
          href="/login"
        >
          Back to sign in
        </Link>
      }
    >
      <Field
        id="reset-email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
      />
    </FormFrame>
  );
}

export function UpdatePasswordForm() {
  return (
    <FormFrame
      title="Choose a new password"
      intro="Reset links are single-use and expire. Choose a password with at least 12 characters."
      action={updatePasswordAction}
      submitLabel="Update password"
      footer={
        <Link
          className="font-semibold text-teal-800 hover:underline"
          href="/forgot-password"
        >
          Request another reset link
        </Link>
      }
    >
      <Field
        id="new-password"
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
      />
      <Field
        id="confirm-password"
        label="Confirm new password"
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
      />
    </FormFrame>
  );
}
