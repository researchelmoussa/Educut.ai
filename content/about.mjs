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

  // Company details
  legalName: 'EduCut AI',
  streetAddress: null,
  postalCode: null,
  locality: 'Switzerland',
  foundingYear: 2025,
  registered: false,
  email: 'partners@educutai.com',
  story: `EduCut AI was founded in Switzerland by high-ranking academics, senior researchers, and university professors in the domain of Artificial Intelligence from world-class research institutions.

Having spent decades at the frontier of machine learning, neural architectures, and algorithmic systems, the founding faculty observed an urgent and widening disconnect: while artificial intelligence was advancing at unprecedented velocity within scientific laboratories, enterprises and educational institutions struggled to translate raw research models into safe, sovereign, and practical operational capabilities. Conventional training was often superficial, product-biased, or rapidly obsolete, while traditional university curricula moved too slowly to meet executive and engineering demands.

EduCut AI was created to solve this challenge. Conceived as an agile bridge between frontier academic research and institutional execution, EduCut provides systematic, vendor-neutral upskilling across 18 specialized academies and 212 accredited curricula. By translating cutting-edge scientific rigor into modular, business-aligned learning paths, EduCut AI empowers organizations, researchers, and future leaders to build genuine, lasting AI capabilities.`,
  sameAs: ['https://www.linkedin.com/company/educut-ai/'],
};

// Experts who teach, author or review. Each entry needs at least name, role
// and expertise; credentials and profileUrl are optional. Nothing here is
// shown until at least one expert is listed.
export const FACULTY = [];

// Legal texts supplied by EduCut.ai (HTML). A page is generated only when
// its text is present; the footer then links to it.
export const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    updated: '2026-10-22',
    html: `
<h2>1. Overview and Scope</h2>
<p>EduCut AI ("EduCut.ai", "we", "our", or "us") is dedicated to protecting your privacy and personal data. This Privacy Policy outlines how we collect, process, store, and safeguard your personal information when you visit our website (educutai.com), take our AI readiness assessment, request course catalogues, book consultations, use EduCut Connect, or interact with our learning workspaces.</p>
<p>Our data handling practices comply with the Swiss Federal Act on Data Protection (FADP / DSG) and the European Union General Data Protection Regulation (GDPR / Regulation (EU) 2016/679).</p>

<h2>2. Data Controller</h2>
<p>The data controller responsible for the processing of your personal data under this policy is:</p>
<p><strong>EduCut AI</strong><br />Switzerland<br />Contact Email: <a href="mailto:partners@educutai.com">partners@educutai.com</a> · <a href="mailto:contact@educutai.com">contact@educutai.com</a></p>

<h2>3. Data We Collect and How We Collect It</h2>
<p>We collect personal information that you voluntarily provide to us, as well as limited technical data generated automatically during your visit:</p>
<ul>
  <li><strong>Assessment & Diagnostic Data:</strong> When you complete our 3-minute AI Path Assessment, we collect your responses (organization size, AI maturity, current tool usage, strategic focus areas) together with your contact information (full name, company name, professional email address).</li>
  <li><strong>Consultation & Catalogue Requests:</strong> When you book a consultation or request our curriculum catalogue, we collect your name, corporate email address, organization name, phone number (if provided), and any specific training requirements or time preferences.</li>
  <li><strong>EduCut Connect & Inquiries:</strong> When you contact our team or inquire about academic/research opportunities, we process your contact information and message content.</li>
  <li><strong>Technical and Usage Data:</strong> When accessing our services, standard technical information (browser type, operating system, IP address, request timestamps) is logged transiently for security, fraud prevention, and system stability.</li>
</ul>

<h2>4. Purposes and Legal Bases for Processing</h2>
<p>We process your data exclusively for defined, legitimate purposes:</p>
<ul>
  <li><strong>Performance of Contractual or Pre-Contractual Measures:</strong> Delivering your personalized 3, 5, or 7-course AI learning path recommendation, calculating indicative quotes, providing scheduled consultations, and sending requested course catalogues.</li>
  <li><strong>Legitimate Interests:</strong> Operating and improving our training curriculum, securing our digital infrastructure against abuse, and communicating with corporate partners regarding relevant B2B learning opportunities.</li>
  <li><strong>Consent:</strong> Where you explicitly check an agreement box, we process your data based on your freely given consent, which may be withdrawn at any time.</li>
  <li><strong>Legal Obligations:</strong> Compliance with applicable Swiss statutory and commercial accounting requirements.</li>
</ul>

<h2>5. Data Storage, Security and Hosting</h2>
<p>Your data is processed and stored securely using industry-standard technical and organizational security measures (including TLS encryption in transit and AES-256 encryption at rest). Our primary database and backend infrastructure are hosted in certified European data center facilities maintaining ISO/IEC 27001 and SOC 2 Type II certifications.</p>
<p>We do not sell, rent, or trade your personal data with third parties for commercial advertising.</p>

<h2>6. Data Retention</h2>
<p>We retain your personal data only for as long as necessary to fulfill the purposes for which it was gathered, including satisfying any legal, accounting, or reporting requirements. Assessment submissions and lead records are reviewed periodically and securely purged or anonymized when no longer required for active educational consultation.</p>

<h2>7. Your Rights Under Swiss and EU Data Protection Law</h2>
<p>You have fundamental rights concerning your personal data:</p>
<ul>
  <li><strong>Right of Access:</strong> Request confirmation as to whether we process your personal data and obtain a copy of that data.</li>
  <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete personal information.</li>
  <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> Request the deletion of your personal data where statutory retention obligations do not apply.</li>
  <li><strong>Right to Restriction of Processing:</strong> Request limits on how we process your personal data under certain conditions.</li>
  <li><strong>Right to Data Portability:</strong> Receive your personal data in a structured, commonly used, and machine-readable format.</li>
  <li><strong>Right to Withdraw Consent:</strong> Withdraw any previously given consent with immediate effect for future processing.</li>
</ul>
<p>To exercise any of these rights, please contact our team at <a href="mailto:partners@educutai.com">partners@educutai.com</a>.</p>

<h2>8. Cookies and Web Analytics</h2>
<p>EduCut.ai prioritizes minimal tracking. We prioritize cookieless, privacy-preserving metrics that do not track users across domains. Necessary local storage keys are utilized strictly to preserve your assessment inputs, session preferences, and authenticated state within the platform.</p>

<h2>9. Changes to This Policy</h2>
<p>We may update this Privacy Policy periodically to reflect technological changes, new service offerings, or evolving legal frameworks. The "Last updated" date at the top of this document indicates when changes were last implemented.</p>
`,
  },

  terms: {
    title: 'Terms & Conditions',
    updated: '2026-10-22',
    html: `
<h2>1. Agreement to Terms</h2>
<p>These Terms and Conditions ("Terms") govern your access to and use of the EduCut AI website (educutai.com), course catalogues, AI Path Assessment, consultation booking services, and EduCut Connect platform (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access or use the Services.</p>

<h2>2. Nature of the Services</h2>
<p>EduCut AI provides professional AI curriculum design, enterprise capability training, organizational AI readiness assessments, and educational upskilling paths across 18 specialized academies and 212 courses.</p>
<p>All recommendations generated by our 3-minute AI Path Assessment, consultation advice, and curriculum outlines are designed for informational and diagnostic guidance. They represent educational recommendations based on the data you provide and do not constitute a binding operational or financial performance guarantee.</p>

<h2>3. Intellectual Property Rights</h2>
<p>All intellectual property rights in the Services, including text, graphics, course codes, syllabus curricula, assessments, diagnostic algorithms, logos, software, and website design, are owned by EduCut AI or its licensors. You may access and review our course descriptions and assessments for your organization's internal evaluation. You may not copy, reproduce, distribute, modify, create derivative works of, publicly display, or commercially exploit our proprietary curricula or software without prior written authorization.</p>

<h2>4. EduCut Connect Directory Disclaimer</h2>
<p>The EduCut Connect section (educutai.com/educut-connect/) lists academic fellowships, PhD vacancies, postdoctoral positions, scholarships, and research opportunities gathered from publicly accessible official institutional announcements.</p>
<ul>
  <li><strong>Not an Employer or Recruiter:</strong> EduCut AI is not the employer, recruiting agency, hiring committee, or scholarship grantor for opportunities listed on EduCut Connect.</li>
  <li><strong>Official Applications:</strong> All applications must be submitted directly through the verified institutional page of the respective university, lab, or organization.</li>
  <li><strong>Accuracy:</strong> While we verify listings against official sources upon publication, deadlines, eligibility criteria, and requirements remain the exclusive discretion of the hosting institution. Candidates are advised to confirm all terms directly on the official host page.</li>
</ul>

<h2>5. Course Bookings and Commercial Agreements</h2>
<p>Consultation requests and catalogue submissions submitted through the website initiate pre-contractual discussions. Formal corporate cohorts, seat allocations, trainer assignments, and customized enterprise enterprise training paths are subject to a mutually executed Corporate Training Agreement or formal quotation issued by EduCut AI.</p>

<h2>6. User Responsibilities and Acceptable Use</h2>
<p>When utilizing our Services, you agree to:</p>
<ul>
  <li>Provide accurate, current, and truthful information during assessments and inquiries.</li>
  <li>Refrain from attempting to reverse-engineer, decompile, scrape, or systematically extract data from our platform, course databases, or back-office interfaces.</li>
  <li>Refrain from submitting malicious code, exploiting vulnerabilities, or disrupting platform availability.</li>
</ul>

<h2>7. Limitation of Liability</h2>
<p>To the maximum extent permitted by applicable Swiss law, EduCut AI and its affiliates, directors, researchers, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or business interruption, arising out of or in connection with your access to or inability to use the Services.</p>

<h2>8. Governing Law and Jurisdiction</h2>
<p>These Terms and any disputes arising out of or related to them shall be governed by and construed in accordance with the substantive laws of Switzerland, excluding its conflict of law provisions. Any legal action or proceeding arising under these Terms shall be brought exclusively before the competent courts of Switzerland.</p>

<h2>9. Contact Information</h2>
<p>For questions or notices regarding these Terms, please contact our team at <a href="mailto:partners@educutai.com">partners@educutai.com</a>.</p>
`,
  },
};
