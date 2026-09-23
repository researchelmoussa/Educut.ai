/* ===================================================================
   EduCut.ai organization, faculty and legal information (SEO plan, Step 10)

   Only facts confirmed by EduCut.ai go here. Empty values stay empty: the
   build leaves them out of the pages and the structured data, and keeps
   /about/ as a noindex draft until the REQUIRED fields are filled in.

   Required to publish /about/:  legalName, story
   Legal pages are generated only when their text is provided.
   =================================================================== */

export const COMPANY = {
  // Confirmed by EduCut.ai.
  country: 'Switzerland',
  countryCode: 'CH',

  // To be provided by EduCut.ai.
  legalName: null,          // e.g. 'EduCut.ai SA'
  streetAddress: null,
  postalCode: null,
  locality: null,           // city
  foundingYear: null,       // e.g. '2025'
  story: null,              // 2–4 sentences: who founded EduCut.ai and why (HTML allowed)
  sameAs: [],               // official profiles, e.g. 'https://www.linkedin.com/company/…'
  // Logo: save the SVG as assets/logo.svg; the build picks it up
  // automatically (favicon + Organization logo).
};

// Experts who teach, author or review. Each entry needs at least name, role
// and expertise; credentials and profileUrl are optional. Nothing here is
// shown until at least one expert is listed.
export const FACULTY = [
  // { name: '', role: '', expertise: '', credentials: '', profileUrl: '' },
];

// Legal texts supplied by EduCut.ai (HTML). A page is generated only when
// its text is present; the footer then links to it.
export const LEGAL = {
  privacy: null,   // { title: 'Privacy Policy', updated: 'YYYY-MM-DD', html: '…' }
  terms: null,     // { title: 'Terms & Conditions', updated: 'YYYY-MM-DD', html: '…' }
};
