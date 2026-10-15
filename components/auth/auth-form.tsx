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
import type { LoginPortal } from "@/lib/auth/login-portals";

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

const portalCopy: Record<
  LoginPortal,
  { title: string; intro: string; footer: ReactNode }
> = {
  customer: {
    title: "Welcome back",
    intro: "Sign in to manage your DawaSetu account and medicine requests.",
    footer: (
      <>
        <span>New to DawaSetu? </span>
        <Link
          className="font-semibold text-teal-800 hover:underline"
          href="/signup"
        >
          Create an account
        </Link>
      </>
    ),
  },
  admin: {
    title: "Admin sign in",
    intro:
      "Sign in with your DawaSetu staff account. Admin permissions and MFA are checked securely before the workspace opens.",
    footer: (
      <span>Admin access is assigned by the DawaSetu platform team.</span>
    ),
  },
  partner: {
    title: "Pharmacy & clinic sign in",
    intro:
      "Manage your approved pharmacy, clinic, or nursing-home availability and requests.",
    footer: (
      <>
        <span>New partner? </span>
        <Link
          className="font-semibold text-teal-800 hover:underline"
          href="/signup"
        >
          Create an account
        </Link>
        <span>, then submit your business for review.</span>
      </>
    ),
  },
  distributor: {
    title: "Distributor sign in",
    intro:
      "Open your private stockist workspace and manage approved partner access.",
    footer: (
      <span>
        Distributor access is reviewed and assigned by the DawaSetu team.
      </span>
    ),
  },
};

const portalLinks: { portal: LoginPortal; label: string; href: string }[] = [
  { portal: "customer", label: "Customer", href: "/login" },
  { portal: "partner", label: "Pharmacy / clinic", href: "/partner/login" },
  { portal: "distributor", label: "Distributor", href: "/distributor/login" },
];

export function LoginForm({ portal = "customer" }: { portal?: LoginPortal }) {
  const copy = portalCopy[portal];
  return (
    <FormFrame
      title={copy.title}
      intro={copy.intro}
      action={signInAction}
      submitLabel="Sign in"
      footer={copy.footer}
    >
      <input type="hidden" name="portal" value={portal} />
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
      <nav
        aria-label="Other DawaSetu sign-in pages"
        className="-mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs"
      >
        {portalLinks
          .filter((item) => item.portal !== portal)
          .map((item) => (
            <Link
              key={item.portal}
              className="rounded-lg border border-slate-200 px-3 py-2 text-center font-medium text-slate-700 hover:border-teal-300 hover:text-teal-900"
              href={item.href}
            >
              {item.label} sign in
            </Link>
          ))}
      </nav>
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
