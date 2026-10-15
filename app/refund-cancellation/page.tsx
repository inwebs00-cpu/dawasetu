import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { getPublicBusinessDetails } from "@/lib/site/public-business-details";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy | DawaSetu",
  description:
    "Understand DawaSetu partner subscription billing, manual renewals, cancellation requests, refund eligibility and payment issue timelines.",
  keywords: [
    "DawaSetu refund policy",
    "DawaSetu cancellation policy",
    "pharmacy subscription refund India",
  ],
  alternates: { canonical: "/refund-cancellation" },
  openGraph: {
    title: "Refund and Cancellation Policy | DawaSetu",
    description:
      "Refund eligibility, payment issue resolution and partner plan cancellation terms.",
    url: "/refund-cancellation",
    type: "website",
  },
};

export default function RefundCancellationPage() {
  const details = getPublicBusinessDetails();
  return (
    <LegalPage
      eyebrow="Legal · Payments"
      title="Refund & Cancellation Policy"
      summary="This policy applies to paid DawaSetu partner subscriptions. Customers do not purchase or receive medicines through DawaSetu."
    >
      <LegalSection title="What DawaSetu charges for">
        <p>
          Paid charges are for digital partner subscription features, such as
          the plan benefits shown before checkout. The selected plan, billing
          interval and total INR amount are displayed before you authorize
          payment. Medicine purchases, pharmacy fulfilment, delivery and doctor
          services are outside DawaSetu checkout.
        </p>
      </LegalSection>

      <LegalSection title="Manual renewal and cancellation">
        <p>
          Subscriptions are paid for the selected monthly or yearly term and do
          not auto-renew. There is no future recurring debit to cancel. You may
          stop using a plan at any time; paid access remains available until the
          displayed period end unless the account is suspended for a legal or
          security reason. To prevent a manual renewal, simply do not start a
          new checkout. Contact support if you want help with access or an
          account closure request.
        </p>
      </LegalSection>

      <LegalSection title="When a refund may be requested">
        <p>
          Because partner subscription access is a digital service that starts
          after successful payment, fees are generally non-refundable once the
          plan is active, except where applicable law requires otherwise. You
          may request a review if you were charged more than once for the same
          checkout, payment succeeded but the plan was not activated, the amount
          or plan applied differs from the checkout confirmation, or a payment
          was unauthorized. Include the registered account email, the business
          name, payment/order reference, amount and date. Never send a card
          number, CVV, UPI PIN or banking password.
        </p>
      </LegalSection>

      <LegalSection title="How to submit a payment request">
        <p>
          Open a support ticket from your signed-in account and choose the
          billing or payments category, or use the verified support contact on
          our <a href="/contact">Contact page</a>. We will acknowledge the
          request within two business days and investigate against the payment
          provider’s transaction record. If a refund is approved, DawaSetu will
          submit it to the original payment method within five business days of
          approval. The bank, card network, UPI app or payment provider may take
          additional time to post the credit. We will share the provider refund
          reference when available.
        </p>
      </LegalSection>

      <LegalSection title="Failed, pending or duplicate payments">
        <p>
          If payment is marked failed but money was debited, please allow the
          payment provider and bank time to reconcile the transaction, then
          contact us with the order reference. If a duplicate charge is
          confirmed, we will refund the duplicate to the original payment
          method. A pending provider response is not treated as a completed
          subscription charge until confirmed.
        </p>
      </LegalSection>

      <LegalSection title="Contact and complaints">
        <p>
          Policy operator:{" "}
          {details.legalName || "the DawaSetu operating entity"}
          {details.address ? `, ${details.address}` : ""}. For a payment or
          cancellation complaint, contact support through the{" "}
          <a href="/contact">Contact page</a>. The public contact page lists the
          support and grievance officer details used for escalation.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
