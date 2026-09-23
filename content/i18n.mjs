/* ===================================================================
   EduCut.ai languages (SEO plan, Step 11)

   The site is English-only today. French is prepared as the first second
   language (French-speaking Switzerland, France, Senegal; quotations are
   already produced in French).

   How a translated page goes live:
     1. Run `node scripts/build-pages.mjs --i18n-kit` to export every
        page-level string to content/i18n/translation-kit.json.
     2. Have it translated professionally or by a native-speaking expert,
        with localized keywords (not literal translations).
     3. Once a French page exists and has been reviewed, map its English
        path to the French path in ALTERNATES below.

   hreflang tags (and sitemap alternates) are emitted only for pages mapped
   here, and the build checks that every mapped page exists — so the site
   never points search engines at a missing or unreviewed translation.
   =================================================================== */

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGES = {
  en: { name: 'English', prefix: '' },
  fr: { name: 'Français', prefix: '/fr' },
};

// English path -> { fr: '/fr/…/' } for reviewed translations only.
// Example: '/academies/': { fr: '/fr/academies/' },
export const ALTERNATES = {};
