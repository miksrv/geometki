---
name: package-upgrades
description: Standing dependency decisions in client/package.json (ESLint 9, typescript-eslint resolution, next-i18next/next-seo subpaths)
type: project
---

- **ESLint stays on 9.x.** `eslint-plugin-react` v7 and `eslint-plugin-import` v2 do not support ESLint 10. Don't upgrade until they do.
- **`resolutions["@typescript-eslint/utils"]`** in `package.json` keeps `eslint-plugin-jest` from using its bundled older `@typescript-eslint/utils`, which is incompatible. Bump it together with `typescript-eslint`.
- **next-i18next v16:** Pages Router API is under subpaths — `appWithTranslation`, `useTranslation`, `Trans` from `'next-i18next/pages'`; `serverSideTranslations` from `'next-i18next/pages/serverSideTranslations'`.
- **next-seo v7:** Pages Router uses `generateNextSeo({...})` from `'next-seo/pages'` inside `<Head>`, not the old `<NextSeo>` component. JSON-LD via `JsonLdScript` from `'next-seo'`.
- `@types/node` is pinned to the Node 20 line to match the engine requirement.

**How to apply:** check these before upgrading dependencies or writing i18n/SEO code.
