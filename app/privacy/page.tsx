import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { getPublicBusinessDetails } from "@/lib/site/public-business-details";

export const metadata: Metadata = {
  title: "Privacy Policy | DawaSetu Medicine Availability Network",
  description:
    "Read how DawaSetu collects, uses, shares and protects account, medicine search, location, support and payment related information.",
  keywords: [
    "DawaSetu privacy policy",
    "medicine availability privacy",
    "health platform data privacy India",
  ],
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | DawaSetu",
    description:
      "How DawaSetu handles account, search, location, support and payment information.",
    url: "/privacy",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  const details = getPublicBusinessDetails();
  return (
    <LegalPage
      eyebrow="Legal · Privacy"
      title="Privacy Policy"
      summary="This policy explains what information DawaSetu handles when customers, pharmacy partners, clinics, nursing homes and distributors use the medicine availability network."
    >
      <LegalSection title="Who operates DawaSetu">
        <p>
          DawaSetu is an availability discovery and connection platform. The
          operator is {details.legalName || "the DawaSetu operating entity"}
          {details.address ? `, with operating address ${details.address}` : ""}
          . Contact details are published on the <a href="/contact">Contact</a>{" "}
          page.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Account details such as your name, email address, phone number,
            preferred language and authentication/session information.
          </li>
          <li>
            Partner-submitted business details, contact information, address,
            map coordinates, opening hours, verification documents and inventory
            status.
          </li>
          <li>
            Medicine searches and saved medicines. Signed-in customers can see
            their recent search history in their account.
          </li>
          <li>
            Medicine availability requests, including medicine, quantity,
            selected area and an optional note. Partners receive only the
            approximate customer area until the customer chooses to contact a
            business.
          </li>
          <li>
            Support ticket text and attachments you submit, plus security and
            audit records needed to protect the platform.
          </li>
          <li>
            Technical usage information such as browser/device headers and
            pseudonymous daily counts for public medicine searches and partner
            profile views. These counts are used for platform analytics.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Location and permissions">
        <p>
          If you choose “Use my location,” your browser asks permission and the
          coordinates are used to sort nearby availability results for that
          request. The search feature does not save those coordinates to your
          DawaSetu profile. If you create a medicine request, you select an area
          that is shared with eligible partners so they can respond.
        </p>
      </LegalSection>

      <LegalSection title="Why we use information">
        <p>
          We use information to provide sign-in, medicine discovery, partner
          listings, customer requests, business dashboards, support, payments
          for partner subscriptions, fraud prevention, security, service
          improvement and legal compliance. We use only the information needed
          for these purposes and restrict access by account role.
        </p>
      </LegalSection>

      <LegalSection title="When information is shared">
        <p>
          Public business information and medicine availability are displayed
          only when the business is approved, public availability is enabled,
          and the individual medicine is marked public. Distributor stock is
          private and available only to authorized business users. We share
          information with infrastructure, authentication, storage and payment
          providers as needed to operate the service, and with a pharmacy when a
          customer submits a request to eligible nearby partners. External
          services such as Click2Book have their own privacy policies.
        </p>
      </LegalSection>

      <LegalSection title="Payments">
        <p>
          Partner subscriptions may be processed by Razorpay or another payment
          provider shown at checkout. Payment credentials such as card numbers,
          UPI PINs and banking passwords are entered with the payment provider;
          DawaSetu does not request or store those credentials. We receive
          transaction identifiers, amount, currency and status to record
          subscription and payment history.
        </p>
      </LegalSection>

      <LegalSection title="Storage, security and retention">
        <p>
          Account sessions use secure authentication cookies. We apply access
          controls, database permissions and private storage rules to protect
          account data, partner documents and support attachments. Information
          is kept while needed to provide the service, meet legal and accounting
          duties, resolve disputes, enforce agreements and maintain security
          records. Retention periods depend on the record type and legal
          obligations.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and requests">
        <p>
          You can review and update your account and business profile while
          signed in. You can decline browser location permission and continue
          with a manually selected area. To ask about access, correction,
          deletion, retention or a privacy concern, contact DawaSetu through the{" "}
          <a href="/contact">Contact page</a>. We may need to verify your
          identity before acting on a request.
        </p>
      </LegalSection>

      <LegalSection title="Children and policy changes">
        <p>
          DawaSetu is not designed for children to create accounts or submit
          medicine requests independently. A parent or guardian should contact
          us about a child’s information. We may update this policy when the
          service or applicable requirements change; the effective date above
          will be revised when we publish an update.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
