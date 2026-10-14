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
  privacy: {
    title: 'Privacy Policy',
    updated: '2026-10-13',
    html: "<p>This policy explains what personal data EduCut.ai collects through educutai.com, why, and what rights you have. EduCut.ai is based in Switzerland. We process personal data in line with the Swiss Federal Act on Data Protection (FADP) and, where it applies to you, the EU General Data Protection Regulation (GDPR).</p>\n\n<h2>1. Who is responsible</h2>\n<p>The controller is EduCut.ai, Switzerland. For any question about this policy or your data, write to <a href=\"mailto:contact@educutai.com\">contact@educutai.com</a>.</p>\n\n<h2>2. What we collect and why</h2>\n<ul>\n  <li><strong>Consultation requests</strong>: your name, company, professional email, phone number, the date you choose and what you tell us about your needs. We use them to organise and hold the consultation and to follow up on it.</li>\n  <li><strong>Catalogue requests</strong>: your name, company and professional email, to send you the catalogue and answer your request.</li>\n  <li><strong>The free AI assessment</strong>: your answers to the questions and the learning path we recommend. We use them to show your result and, if you have an account or ask us to contact you, to advise you on courses.</li>\n  <li><strong>Accounts</strong> (individual learners, company administrators and company learners): name, email, company, password (stored only in encrypted form by our authentication provider), your courses, progress and certificates, and the notification preferences you choose. We use them to give you access to the platform and your learning.</li>\n  <li><strong>Company accounts</strong>: the names and professional emails of employees a company administrator invites, their course assignments and access dates, as well as requests, invoices and quotations exchanged with the company. The company decides which employees it invites and is responsible for informing them.</li>\n  <li><strong>Messages and support requests</strong>, including any file you attach, to answer you.</li>\n  <li><strong>Technical data</strong>: our hosting provider processes your IP address and basic request data (date, page, browser) to deliver the website and keep it secure.</li>\n</ul>\n<p>We process this data to answer your requests and provide our services (contract or pre-contractual steps), on the basis of your consent where we ask for it, and for our legitimate interest in running and securing the website.</p>\n\n<h2>3. Cookies and browser storage</h2>\n<p>educutai.com does not use advertising or analytics cookies and does not track you across other websites. The site stores a few items in your browser (local and session storage) so that it works: for example keeping you signed in, your assessment progress and your display choices. You can clear them at any time in your browser settings; you will then be signed out.</p>\n\n<h2>4. Who processes the data for us</h2>\n<p>We do not sell your personal data. We share it only with service providers that process it on our behalf and under our instructions:</p>\n<ul>\n  <li><strong>Vercel</strong>: website hosting and delivery.</li>\n  <li><strong>Supabase</strong>: database and sign-in (authentication).</li>\n  <li><strong>Resend</strong>: sending emails (account activation, invitations, confirmations, replies).</li>\n</ul>\n<p>We may also disclose data when the law requires it.</p>\n\n<h2>5. Transfers abroad</h2>\n<p>These providers may process data outside Switzerland, in particular in the European Union and the United States. Where the destination country does not offer an adequate level of protection, we rely on appropriate safeguards such as the standard contractual clauses recognised by the Swiss Federal Data Protection and Information Commissioner and the European Commission.</p>\n\n<h2>6. How long we keep data</h2>\n<ul>\n  <li>Account data: for as long as your account is active, then deleted or anonymised, unless we must keep it longer by law (for example invoices and accounting records, which Swiss law requires us to keep for 10 years).</li>\n  <li>Consultation and catalogue requests and messages: up to 2 years after our last exchange.</li>\n  <li>Assessment answers not linked to an account: up to 12 months.</li>\n</ul>\n\n<h2>7. Your rights</h2>\n<p>You can ask to access your personal data, correct it, delete it, receive it in a common electronic format, restrict or object to its processing, and withdraw any consent you gave, at any time and without affecting what was done before. Write to <a href=\"mailto:contact@educutai.com\">contact@educutai.com</a>; we answer within 30 days. If you believe we process your data unlawfully, you can complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC) or, if you live in the EU, to the data protection authority of your country.</p>\n\n<h2>8. Security</h2>\n<p>We use encrypted connections (HTTPS), access controls and providers with recognised security practices. No system is completely secure; if a breach affects your data and puts you at risk, we will inform you and the authorities as the law requires.</p>\n\n<h2>9. EduCut Connect</h2>\n<p>EduCut Connect lists job, fellowship and research opportunities published by other institutions. When you apply, you do so on the institution's own website, under its own privacy policy; EduCut.ai does not receive your application. Our LinkedIn pages are also subject to LinkedIn's privacy policy.</p>\n\n<h2>10. Changes</h2>\n<p>We may update this policy. The date at the top shows the latest version; important changes will be announced on the website.</p>",
  },
  terms: null,     // { title: 'Terms & Conditions', updated: 'YYYY-MM-DD', html: '…' }
};
