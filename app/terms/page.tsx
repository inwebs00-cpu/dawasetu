import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { getPublicBusinessDetails } from "@/lib/site/public-business-details";

export const metadata: Metadata = {
  title: "Terms and Conditions | DawaSetu",
  description:
    "Terms for using DawaSetu to find nearby medicine availability, contact pharmacies and manage approved partner listings and subscriptions.",
  keywords: [
    "DawaSetu terms and conditions",
    "medicine availability platform terms",
    "pharmacy partner subscription terms India",
  ],
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms and Conditions | DawaSetu",
    description:
      "Terms for customers, pharmacies and healthcare partners using DawaSetu.",
    url: "/terms",
    type: "website",
  },
};

export default function TermsPage() {
  const details = getPublicBusinessDetails();
  return (
    <LegalPage
      eyebrow="Legal · Terms of use"
      title="Terms & Conditions"
      summary="These terms cover access to DawaSetu’s medicine availability search, public business directory, customer requests, partner dashboards and paid partner plans."
    >
      <LegalSection title="The DawaSetu service">
        <p>
          DawaSetu is operated by{" "}
          {details.legalName || "the DawaSetu operating entity"}
          {details.address ? ` at ${details.address}` : ""}. The platform helps
          people discover partner-reported availability and contact a business.
          DawaSetu does not sell, dispense, deliver or prescribe medicines and
          is not a substitute for a doctor, pharmacist or emergency service.
        </p>
      </LegalSection>

      <LegalSection title="Availability and medical information">
        <p>
          Stock information is submitted by independent partner businesses, can
          change without notice and is not a guarantee that a medicine is
          available when you arrive. Call the pharmacy to confirm. Search
          results and composition matches are for discovery only. DawaSetu does
          not diagnose, recommend a treatment or determine that one medicine can
          safely replace another. Ask a doctor or pharmacist before changing a
          prescribed medicine.
        </p>
      </LegalSection>

      <LegalSection title="Accounts and acceptable use">
        <p>
          Provide accurate account information, keep your password and
          verification factors private, and tell us if you suspect unauthorized
          access. You are responsible for activity under your account. Do not
          misuse search, requests, messaging, uploads or platform access; submit
          false business information; interfere with security; or use the
          service to provide unlawful medical advice or sell restricted
          medicines.
        </p>
      </LegalSection>

      <LegalSection title="Partner business responsibilities">
        <p>
          Partners must have authority to publish their business information,
          keep inventory and contact details accurate, update out-of-stock
          listings promptly, and comply with applicable pharmacy, healthcare,
          consumer and data-protection requirements. Public visibility is
          available only to approved eligible businesses. Distributor inventory
          remains private and may be accessed only by authorized network
          partners under their permissions.
        </p>
      </LegalSection>

      <LegalSection title="Subscriptions and payments">
        <p>
          Partner plan features, limits, billing interval and price are shown
          before payment and may be changed for future purchases. Prices are in
          Indian Rupees unless checkout states otherwise. A plan starts after
          payment confirmation and the selected paid term is one month or one
          year. Plans renew manually; DawaSetu does not automatically charge a
          saved payment method. A plan change takes effect when replacement
          payment succeeds. See the{" "}
          <a href="/refund-cancellation">Refund &amp; Cancellation Policy</a>{" "}
          for cancellation and refund terms.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services and links">
        <p>
          Payments are handled by the payment provider shown at checkout and are
          subject to its terms. Appointment and other external service links
          open third-party websites. DawaSetu does not control their content,
          security, booking, prices or availability.
        </p>
      </LegalSection>

      <LegalSection title="Content, access and changes">
        <p>
          You retain rights to content you submit and allow DawaSetu to host and
          display it as needed to provide the service and according to your
          visibility settings. We may remove unlawful, unsafe or misleading
          content, restrict an account for security or compliance, and change or
          discontinue features with reasonable notice where practicable.
        </p>
      </LegalSection>

      <LegalSection title="Complaints and governing law">
        <p>
          Send questions or complaints through the{" "}
          <a href="/contact">Contact page</a>. These terms are governed by the
          laws of India. Courts with jurisdiction at the operator’s registered
          office will handle disputes, subject to applicable consumer-protection
          rights and mandatory law.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
