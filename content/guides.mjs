/* ===================================================================
   EduCut.ai guides (SEO plan, Step 9)

   Each guide stays a DRAFT until a named EduCut.ai expert has reviewed it.
   Drafts are built with <meta name="robots" content="noindex">, a visible
   draft banner, and are left out of the sitemap, llms.txt, the footer and
   every other page's links.

   To publish a guide, set:
     status: 'published'
     author: { name, jobTitle }            — a real person at EduCut.ai
     reviewer: { name, jobTitle } | null   — optional second expert
     datePublished: 'YYYY-MM-DD'
   The build refuses to publish a guide without an author and a date.

   Text in [[double brackets]] is a note for the reviewer. The build
   refuses to publish a guide that still contains one.
   =================================================================== */

export const GUIDES = [
  {
    slug: 'ai-readiness-assessment',
    status: 'draft',
    author: null,
    reviewer: null,
    datePublished: null,
    dateModified: null,
    title: 'How to assess your organization’s AI readiness',
    seoTitle: 'AI Readiness Assessment: A Practical Guide',
    description: 'What AI readiness means, the four maturity levels, the dimensions to assess and how readiness translates into concrete AI learning priorities.',
    lead: 'AI readiness is not a single score. It is the combination of how your organization uses AI today, what your people understand, how clear your strategy is and how well you manage the risks. This guide explains how to assess each dimension and turn the result into learning priorities.',
    related: ['A018', 'A006', 'A016'],
    body: `
<h2>What AI readiness means</h2>
<p>An organization is ready for AI when it can adopt AI tools and build AI capabilities <strong>usefully and safely</strong>: people know what AI can and cannot do, teams have clear priorities, and the organization can manage the risks that come with its data and use cases. Readiness is therefore closer to a profile than to a pass or fail result.</p>
<p>[[Reviewer: add EduCut.ai’s own perspective or an example from your work with organizations, if you have one you can share.]]</p>

<h2>The four dimensions of AI maturity</h2>
<p>The EduCut.ai assessment measures maturity on four dimensions. Each is asked as a single, concrete question:</p>
<table class="facts"><tbody>
  <tr><th scope="row">Current use of AI</th><td>From “we have barely started using AI” to “AI systems are already integrated into business processes”.</td></tr>
  <tr><th scope="row">AI literacy</th><td>Employees’ general understanding of AI, from “very limited” to “advanced”.</td></tr>
  <tr><th scope="row">AI strategy</th><td>From “we do not have an AI strategy” to “we have a structured organization-wide AI strategy”.</td></tr>
  <tr><th scope="row">Risk preparedness</th><td>How prepared the organization is to manage privacy, bias, security, responsible use, regulation and human oversight — from “not addressed yet” to “mature enterprise AI governance”.</td></tr>
</tbody></table>
<p>Together, these four answers give an AI readiness score out of 100.</p>

<h2>The four maturity levels</h2>
<table class="facts"><tbody>
  <tr><th scope="row">Exploring (below 30)</th><td>AI use is occasional and informal. The priority is shared understanding and a first, well-chosen use case.</td></tr>
  <tr><th scope="row">Developing (30–54)</th><td>Some teams use AI regularly. The priority is turning individual use into repeatable team workflows and basic rules for responsible use.</td></tr>
  <tr><th scope="row">Scaling (55–74)</th><td>Several projects or pilots exist. The priority is specialization, governance and connecting AI to the organization’s own data and processes.</td></tr>
  <tr><th scope="row">Advanced (75 and above)</th><td>AI is part of strategy and operations. The priority is scale, measurement of value and mature governance and security.</td></tr>
</tbody></table>
<p>[[Reviewer: confirm or refine the description of each level.]]</p>

<h2>Beyond maturity: what your organization needs</h2>
<p>Two organizations with the same maturity can need very different training. The assessment therefore also asks about:</p>
<ul>
  <li><strong>Goals</strong> — the main reason for investing in AI training, and up to three other outcomes that matter.</li>
  <li><strong>People</strong> — which teams should benefit most, and who should take part first.</li>
  <li><strong>Technical ambition</strong> — use of generative AI, analytics, building your own AI applications, using your own documents and knowledge with AI, and AI agents.</li>
  <li><strong>Risk context</strong> — how sensitive the information employees may use with AI is.</li>
  <li><strong>Target and horizon</strong> — the level of AI capability you ultimately want (from AI awareness to an AI-driven organization) and how quickly you want to get there.</li>
</ul>

<h2>From readiness to learning priorities</h2>
<p>Most answers add weight to one or more of <a href="/ai-learning-paths/#focus-areas">14 focus areas</a>, such as AI productivity, generative AI and prompting, RAG and enterprise knowledge, AI agents and automation, AI transformation, or responsible AI, governance and security. The highest-scoring areas become your priorities, and each one is mapped to specific courses in the EduCut.ai catalogue.</p>
<p>For example, an organization that rates everyday productivity as a top priority, handles confidential information and has only begun to discuss AI risks will see AI productivity and responsible AI, governance and security near the top of its results.</p>

<h2>How to run your own readiness check</h2>
<ol>
  <li><strong>Involve the right people.</strong> Answer together with someone who knows how teams actually use AI today, not only the official strategy.</li>
  <li><strong>Be honest about current use.</strong> Informal use of public AI tools counts — and matters for risk.</li>
  <li><strong>Separate ambition from reality.</strong> Your target capability and your current maturity are different questions.</li>
  <li><strong>Turn the result into a plan.</strong> Start with the highest-priority capability, then broaden.</li>
</ol>
<p><a href="/#start-assessment">Take the free 3-minute EduCut.ai assessment</a> to receive your readiness score, your strongest opportunity and three learning paths built from real courses.</p>
`,
    faq: [
      ['How long does an AI readiness assessment take?', 'The EduCut.ai assessment has 20 multiple-choice questions and takes about 3 minutes.'],
      ['What are the AI maturity levels?', 'Exploring (below 30 out of 100), Developing (30–54), Scaling (55–74) and Advanced (75 and above).'],
      ['What does AI readiness depend on?', 'Current use of AI, employees’ AI literacy, the clarity of the AI strategy and preparedness to manage AI-related risks.'],
    ],
  },

  {
    slug: 'ai-training-plan',
    status: 'draft',
    author: null,
    reviewer: null,
    datePublished: null,
    dateModified: null,
    title: 'Building an AI training plan for your company: the 3-5-7 model',
    seoTitle: 'AI Training Plan for Companies: the 3-5-7 Model',
    description: 'How to build a focused AI training plan for your company with three paths of 3, 5 and 7 courses — Essential, Accelerate and Transform — chosen from your priorities.',
    lead: 'Most AI training fails in one of two ways: a generic course library nobody finishes, or a single workshop that changes nothing. A focused plan starts from your priorities and grows in clear steps. This guide explains the 3-5-7 model EduCut.ai uses.',
    related: ['A004', 'A018', 'A006'],
    body: `
<h2>Why generic course libraries fall short</h2>
<p>Large libraries leave every employee to choose alone. Organizations end up with scattered knowledge and little change in how teams work. EduCut.ai takes the opposite approach: a focused, AI-only catalogue and a recommendation built from your organization’s maturity, business priorities, target teams, technical ambition and governance needs.</p>
<p>[[Reviewer: add your own experience of what makes corporate AI training succeed or fail.]]</p>

<h2>Three paths with increasing depth</h2>
<table class="facts"><tbody>
  <tr><th scope="row">Essential — 3 courses</th><td><strong>Quick capability.</strong> Build shared understanding and activate your first high-value AI use cases: core AI literacy, immediate business application, one prioritized capability. <em>Understand → Apply → Quick win.</em></td></tr>
  <tr><th scope="row">Accelerate — 5 courses</th><td><strong>Operational capability.</strong> Build repeatable workflows and stronger team-level AI capabilities: foundations plus specialization, workflow acceleration, responsible adoption. <em>Apply → Automate → Specialize.</em></td></tr>
  <tr><th scope="row">Transform — 7 courses</th><td><strong>Strategic capability.</strong> Connect skills, technology, governance and business transformation: cross-functional capability, governance and risk, scale and transformation. <em>Strategy → Govern → Scale.</em></td></tr>
</tbody></table>

<h2>How the courses are chosen</h2>
<ol>
  <li><strong>Priorities first.</strong> Your assessment answers are scored across <a href="/ai-learning-paths/#focus-areas">14 focus areas</a>, and the highest-scoring areas are ranked.</li>
  <li><strong>Courses in order.</strong> Each focus area is mapped to specific courses, from introductory to more advanced. Courses are taken from your top priority first, then the next.</li>
  <li><strong>Three cut-offs.</strong> Transform takes the first 7 courses and Accelerate the first 5. Essential takes 3, favouring courses that have no prerequisites so the team can start immediately.</li>
</ol>

<h2>An example</h2>
<p>Suppose an organization’s top priorities come out as <strong>AI productivity</strong>, then <strong>responsible AI, governance and security</strong>, then <strong>generative AI and prompting</strong>. With the current catalogue, its paths would be:</p>
<table class="facts"><tbody>
  <tr><th scope="row">Essential (3)</th><td><a href="/academies/ai-productivity/#a004-01">AI Productivity Fundamentals</a> · <a href="/academies/ai-productivity/#a004-03">AI for Documents, Reports &amp; Presentations</a> · <a href="/academies/responsible-ai/#a015-01">Responsible AI Fundamentals</a></td></tr>
  <tr><th scope="row">Accelerate (5)</th><td>AI Productivity Fundamentals · AI for Documents, Reports &amp; Presentations · <a href="/academies/ai-productivity/#a004-09">AI Automation &amp; No-Code Workflows</a> · Responsible AI Fundamentals · <a href="/academies/ai-governance/#a016-01">AI Governance Fundamentals</a></td></tr>
  <tr><th scope="row">Transform (7)</th><td>The five Accelerate courses, plus <a href="/academies/ai-security/#a017-01">AI Security Fundamentals</a> and <a href="/academies/generative-ai/#a002-07">Inference &amp; Prompting I</a></td></tr>
</tbody></table>
<p>AI Automation &amp; No-Code Workflows has prerequisites, so the Essential path replaces it with the next course that has none.</p>

<h2>Choosing teams and scope</h2>
<ul>
  <li><strong>Start where value is clearest.</strong> A leadership team, one specialized department, the technical team, several departments or an organization-wide cohort all make sense — for different goals.</li>
  <li><strong>Match the horizon.</strong> Essential fits “start now”; Accelerate fits a 3–6 month plan; Transform fits a 6–12 month or longer program.</li>
  <li><strong>Mix levels deliberately.</strong> The catalogue runs from foundation to advanced level, so the same plan can serve beginners and specialists.</li>
</ul>

<h2>How the training is delivered</h2>
<p>Courses are blended: instructor-led online sessions combined with self-paced personal work — typically 9 hours per course (6 hours online and 3 hours of personal work), or 12 hours (8 hours online and 4 hours of personal work) for the AI Foundations, Generative AI and Data Analytics academies. Each course ends with a certificate. Courses are taught in English, and translation is available.</p>

<h2>Next steps</h2>
<p><a href="/#start-assessment">Take the free assessment</a> to receive your three paths, or <a href="/contact/">book a free one-hour consultation</a> to build the plan together.</p>
`,
    faq: [
      ['What is the 3-5-7 model?', 'Three AI learning paths of increasing depth: Essential (3 courses) for quick capability, Accelerate (5 courses) for operational capability and Transform (7 courses) for strategic capability.'],
      ['How are the courses in each path chosen?', 'Assessment answers are scored across 14 focus areas; courses mapped to the highest-priority areas are taken in order. Transform takes the first 7, Accelerate the first 5, and Essential 3, favouring courses without prerequisites.'],
      ['How long is each course?', 'Typically 9 hours (6 hours online and 3 hours of personal work); courses in the AI Foundations, Generative AI and Data Analytics academies take 12 hours (8 + 4).'],
    ],
  },

  {
    slug: 'eu-ai-act-training',
    status: 'draft',
    author: null,
    reviewer: null,
    datePublished: null,
    dateModified: null,
    title: 'EU AI Act: what your teams need to learn',
    seoTitle: 'EU AI Act Training: What Your Teams Need to Learn',
    description: 'What the EU AI Act means for organizations, the AI literacy duty, and which roles need which knowledge — with a training map to the relevant EduCut.ai courses.',
    lead: 'The EU AI Act makes AI knowledge a compliance topic, not only a productivity one. This guide summarizes what the regulation expects from organizations that use or build AI, and maps the knowledge each role needs.',
    related: ['A016', 'A015', 'A017'],
    body: `
<div class="notice"><strong>Not legal advice.</strong> This guide is general information about training needs. For your specific obligations, consult qualified legal counsel.</div>

<h2>The EU AI Act in brief</h2>
<p>The EU Artificial Intelligence Act (Regulation (EU) 2024/1689) entered into force on 1 August 2024. It regulates AI according to risk:</p>
<ul>
  <li><strong>Prohibited practices</strong> — AI uses considered an unacceptable risk.</li>
  <li><strong>High-risk AI systems</strong> — subject to requirements such as risk management, data governance, documentation, human oversight, accuracy and security.</li>
  <li><strong>Transparency obligations</strong> — for example, informing people when they interact with an AI system or when content is AI-generated.</li>
  <li><strong>General-purpose AI models</strong> — specific obligations for their providers.</li>
</ul>
<p>It applies to organizations that provide or deploy AI systems in the EU, and can also apply to organizations outside the EU when their AI systems or outputs are used in the EU.</p>
<p>[[Reviewer: confirm the scope summary and the application dates below against the current official text. The European Commission proposed changes to the timeline for high-risk obligations in November 2025; check whether they have been adopted.]]</p>

<h2>Key dates</h2>
<table class="facts"><tbody>
  <tr><th scope="row">2 February 2025</th><td>Prohibited practices and the AI literacy obligation (Article 4) apply.</td></tr>
  <tr><th scope="row">2 August 2025</th><td>Obligations for general-purpose AI models and the governance framework apply.</td></tr>
  <tr><th scope="row">2 August 2026</th><td>Most remaining provisions apply, including many high-risk requirements. [[Reviewer: verify.]]</td></tr>
  <tr><th scope="row">2 August 2027</th><td>Requirements for high-risk AI embedded in products covered by existing EU product legislation. [[Reviewer: verify.]]</td></tr>
</tbody></table>

<h2>The AI literacy duty</h2>
<p>Article 4 requires providers and deployers of AI systems to take measures to ensure, to their best extent, a sufficient level of AI literacy among their staff and other people dealing with AI systems on their behalf — taking into account their technical knowledge, experience, education and training, and the context in which the systems are used. In practice, this makes role-appropriate AI training part of compliance.</p>

<h2>Who needs to learn what</h2>
<table class="compare">
  <thead><tr><th scope="col">Role</th><th scope="col">What they need to understand</th><th scope="col">Relevant EduCut.ai courses</th></tr></thead>
  <tbody>
    <tr><th scope="row">All staff using AI</th><td data-label="What they need to understand">What AI can and cannot do, responsible use, and what information must not be shared with AI tools.</td><td data-label="Relevant courses"><a href="/academies/responsible-ai/#a015-01">Responsible AI Fundamentals</a> · <a href="/academies/ai-productivity/#a004-01">AI Productivity Fundamentals</a></td></tr>
    <tr><th scope="row">Leadership</th><td data-label="What they need to understand">Accountability, risk appetite, governance structures and decision rights for AI.</td><td data-label="Relevant courses"><a href="/academies/ai-for-leaders/#a006-07">Responsible AI, Ethics &amp; Governance</a> · <a href="/academies/ai-governance/#a016-01">AI Governance Fundamentals</a></td></tr>
    <tr><th scope="row">Compliance, legal and risk</th><td data-label="What they need to understand">The regulatory landscape, risk classification, impact assessment, policies and evidence.</td><td data-label="Relevant courses"><a href="/academies/ai-governance/#a016-02">AI Regulations, Laws &amp; Global Compliance</a> · <a href="/academies/ai-governance/#a016-03">AI Risk Management &amp; Impact Assessment</a> · <a href="/academies/ai-governance/#a016-04">AI Policies, Standards &amp; Internal Controls</a> · <a href="/academies/responsible-ai/#a015-08">AI Regulation, Compliance &amp; Standards</a></td></tr>
    <tr><th scope="row">AI owners and technical teams</th><td data-label="What they need to understand">AI inventories and lifecycle governance, documentation, human oversight, security and monitoring.</td><td data-label="Relevant courses"><a href="/academies/ai-governance/#a016-05">AI Inventory, Classification &amp; Lifecycle Governance</a> · <a href="/academies/ai-governance/#a016-09">AI Audit, Monitoring &amp; Governance Evidence</a> · <a href="/academies/ai-security/#a017-01">AI Security Fundamentals</a></td></tr>
    <tr><th scope="row">Procurement</th><td data-label="What they need to understand">Due diligence, contractual requirements and ongoing oversight of AI vendors.</td><td data-label="Relevant courses"><a href="/academies/ai-governance/#a016-07">AI Vendor &amp; Third-Party Governance</a></td></tr>
  </tbody>
</table>
<p>[[Reviewer: confirm the role-to-course mapping.]]</p>

<h2>Building an AI literacy program</h2>
<ol>
  <li><strong>Map who uses or oversees AI.</strong> Start from an inventory of AI systems and the people who operate, use or supervise them.</li>
  <li><strong>Set the level by role and context.</strong> The duty is proportionate: what a customer-service agent needs differs from what an AI engineer or a compliance officer needs.</li>
  <li><strong>Train, and keep records.</strong> Document who was trained on what, and review it as systems and roles change.</li>
  <li><strong>Connect training to governance.</strong> Policies, risk assessments and oversight only work if people understand them.</li>
</ol>
<p>Training supports compliance but does not by itself make an organization compliant. <a href="/contact/">Book a free consultation</a> to build a role-based AI literacy plan, or explore the <a href="/academies/ai-governance/">AI Governance courses</a>.</p>
`,
    faq: [
      ['When did the EU AI Act enter into force?', 'On 1 August 2024. Its provisions apply in stages; the AI literacy obligation and the prohibited practices have applied since 2 February 2025.'],
      ['What is the AI literacy obligation?', 'Article 4 requires providers and deployers of AI systems to take measures to ensure, to their best extent, a sufficient level of AI literacy among staff and others dealing with AI systems on their behalf, taking into account their knowledge, experience and the context of use.'],
      ['Does training make an organization compliant with the EU AI Act?', 'No. Training supports compliance — and AI literacy is itself an obligation — but compliance depends on the organization’s AI systems, role and controls. Seek qualified legal advice for specific obligations.'],
    ],
  },
];
