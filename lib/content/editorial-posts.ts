export interface EditorialSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface EditorialSource {
  label: string;
  url: string;
}

export interface EditorialPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  seo_title: string;
  seo_description: string;
  published_at: string;
  content: string;
  sections: EditorialSection[];
  sources: EditorialSource[];
}

const reviewedDate = "2026-10-16T04:00:00.000Z";

export const editorialPosts: EditorialPost[] = [
  {
    id: "find-medicine-availability-nearby",
    slug: "find-medicine-availability-nearby",
    title: "How to check medicine availability at nearby pharmacies",
    summary:
      "Use medicine name, strength and location details to find nearby partner reports, then confirm stock directly with the pharmacy before visiting.",
    seo_title: "Find Medicine Availability Near You in India | DawaSetu",
    seo_description:
      "A practical guide to searching nearby pharmacy medicine availability by brand, composition, strength and location, and confirming stock before a visit.",
    published_at: reviewedDate,
    sections: [
      {
        heading: "Search using the details on your prescription or pack",
        paragraphs: [
          "Start with the product or brand name. If you do not find a match, search by the composition or generic name and include the strength shown on the prescription or pack. A strength and pack size can distinguish products with similar names.",
          "Choose your area or use your location to sort nearby results. DawaSetu displays availability reported by participating businesses; a listing is a useful starting point, not a reservation or a guarantee that stock is still available.",
        ],
      },
      {
        heading: "Confirm before travelling",
        paragraphs: [
          "Stock can change after a pharmacy updates its listing. Call the pharmacy and confirm the exact product, strength, pack size, current availability, price and opening hours before you travel. Ask the pharmacist if you have a question about a prescription or product match.",
        ],
        bullets: [
          "Keep the medicine name, strength and pack details ready.",
          "Check the last-updated time on the availability result.",
          "Do not change a prescribed medicine based only on a search result.",
        ],
      },
      {
        heading: "Availability discovery, not a medical recommendation",
        paragraphs: [
          "DawaSetu connects people with approved local pharmacies and care partners. It does not diagnose conditions, issue prescriptions or decide whether one medicine can replace another. Confirm a substitution with your doctor or pharmacist.",
        ],
      },
    ],
    content: "",
    sources: [],
  },
  {
    id: "what-to-ask-when-calling-a-pharmacy",
    slug: "what-to-ask-when-calling-a-pharmacy",
    title: "What to ask when calling a pharmacy about a medicine",
    summary:
      "A short checklist helps you confirm the right product and practical details with a local pharmacist before making a trip.",
    seo_title: "What to Ask a Pharmacy Before You Visit | DawaSetu",
    seo_description:
      "Confirm a medicine's name, strength, pack size, availability and store hours directly with a pharmacy before visiting.",
    published_at: reviewedDate,
    sections: [
      {
        heading: "Have the product details ready",
        paragraphs: [
          "Read the medicine name from the prescription or original pack. Include the strength and dosage form when shown, such as tablet, capsule or liquid. If the label lists a composition, share it with the pharmacist to help distinguish products with similar names.",
          "For prescription medicines, follow the prescription and the pharmacy's lawful dispensing requirements. DawaSetu does not verify a prescription or authorize a purchase.",
        ],
      },
      {
        heading: "Confirm stock and store details",
        paragraphs: [
          "Ask whether the exact product and pack are currently available, when the information was last checked, and whether the pharmacy is open when you plan to arrive. You can also ask about the current price and accepted payment methods. These details can change and should be confirmed directly with the business.",
        ],
        bullets: [
          "Exact brand or product name and composition",
          "Strength, dosage form and pack size",
          "Current availability, price and opening hours",
        ],
      },
      {
        heading: "Ask a qualified professional about medicine choices",
        paragraphs: [
          "If the named product is unavailable, ask your doctor or pharmacist what to do. DawaSetu may show products with matching composition, but it does not determine whether a switch is suitable for you.",
        ],
      },
    ],
    content: "",
    sources: [],
  },
  {
    id: "store-medicines-according-to-the-label",
    slug: "store-medicines-according-to-the-label",
    title: "How to store medicines: follow the product label",
    summary:
      "Medicine storage instructions can differ by product. Check the label and ask a pharmacist if the temperature or handling directions are unclear.",
    seo_title: "How to Store Medicines Safely at Home | DawaSetu",
    seo_description:
      "Learn why medicine storage directions vary and why the product label and pharmacist are the right sources for handling instructions.",
    published_at: reviewedDate,
    sections: [
      {
        heading: "Use the storage directions for that product",
        paragraphs: [
          "There is no single storage rule for every medicine. Follow the instructions printed on the specific product label or patient information. Some products have temperature limits or moisture precautions; do not guess if a label is missing or hard to understand.",
          "India's National Formulary includes patient guidance that storage instructions should follow the conditions on the product label. If you are unsure how to store a medicine, ask the dispensing pharmacist rather than changing its container or storage location yourself.",
        ],
      },
      {
        heading: "Keep product information together",
        paragraphs: [
          "Keep the original packaging and written instructions with the medicine when practical. This helps you identify the product and refer back to its storage directions. Ask a pharmacist what to do if a medicine was exposed to a temperature outside the label instructions.",
        ],
      },
      {
        heading: "Read the source guidance",
        paragraphs: [
          "The National Formulary of India describes how to communicate medicine use and storage instructions to patients. Product-specific directions remain the guide for an individual medicine.",
        ],
      },
    ],
    content: "",
    sources: [
      {
        label:
          "National Formulary of India, Appendix 14 (CDSCO / Ministry of Health and Family Welfare)",
        url: "https://cdsco.mohfw.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadDataBankContent/NFI_2011%20%281%29.pdf",
      },
    ],
  },
  {
    id: "antibiotics-use-only-as-prescribed",
    slug: "antibiotics-use-only-as-prescribed",
    title: "Antibiotics: use them only as prescribed",
    summary:
      "Antibiotics need professional guidance. Do not self-start, share or switch them; ask your prescriber or pharmacist about questions on your treatment.",
    seo_title: "Antibiotics: Follow Your Prescriber's Guidance | DawaSetu",
    seo_description:
      "WHO guidance explains why antibiotics should be used appropriately. Ask a qualified clinician or pharmacist about your own treatment.",
    published_at: reviewedDate,
    sections: [
      {
        heading: "Do not self-start or share antibiotics",
        paragraphs: [
          "Antibiotics are medicines used for certain infections and need appropriate professional selection. Do not take leftover antibiotics, use another person's medicine, or start an antibiotic based on a search result or an online post.",
          "The World Health Organization identifies inappropriate use and overuse of antibiotics as factors that contribute to antimicrobial resistance. Use antibiotics only when prescribed by a qualified health professional, and ask that professional or a pharmacist if you are unsure about the instructions.",
        ],
      },
      {
        heading: "Ask before making a change",
        paragraphs: [
          "If you have a concern about side effects, a missed dose, an unavailable product or whether to continue treatment, contact the prescriber or pharmacist who knows your situation. Do not change a prescribed course based on a pharmacy search result or general information page.",
        ],
      },
      {
        heading: "The role of DawaSetu",
        paragraphs: [
          "DawaSetu helps people find partner-reported availability and contact pharmacies. It does not diagnose infections, prescribe antibiotics or recommend a substitute.",
        ],
      },
    ],
    content: "",
    sources: [
      {
        label: "World Health Organization: Antimicrobial resistance",
        url: "https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance",
      },
    ],
  },
];

for (const post of editorialPosts) {
  post.content = post.sections
    .map((section) =>
      [
        section.heading,
        ...section.paragraphs,
        ...(section.bullets ?? []).map((bullet) => `• ${bullet}`),
      ].join("\n\n"),
    )
    .join("\n\n");
}
