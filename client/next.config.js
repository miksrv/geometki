const { execFileSync } = require('node:child_process')
const path = require('node:path')

const { i18n } = require('./next-i18next.config.js')

// TEMPORARY until simple-react-ui-kit ships styles.css, see TODO-kit-styles-css.md in the repo root.
// Component styles of simple-react-ui-kit, rendered into the server HTML by pages/_document.tsx
// so the page does not shift when the kit injects them on hydration (see the script)
const kitComponentsCss = execFileSync(process.execPath, [path.join(__dirname, 'scripts/kit-components-css.mjs')], {
    cwd: __dirname,
    encoding: 'utf8'
})

/** @type {import('next').NextConfig} */
const nextConfig = {
    i18n: { ...i18n, localeDetection: false },
    // Authorization does not work in this mode
    reactStrictMode: false,
    images: {
        // https://nextjs.org/docs/pages/api-reference/components/image
        remotePatterns: [
            {
                hostname: 'api.geometki.com',
                port: '',
                protocol: 'https'
            },
            {
                hostname: 'geometki.com',
                port: '',
                protocol: 'https'
            },
            {
                hostname: 'miksoft.pro',
                port: '',
                protocol: 'https'
            },
            {
                hostname: 'localhost',
                port: '8080',
                protocol: 'http'
            }
        ],
        qualities: [50, 75],
        formats: ['image/avif', 'image/webp'],
        // unoptimized - When true, the source image will be served as-is instead of changing quality,
        // size, or format. Defaults to false.
        unoptimized: false
    },
    env: {
        KIT_COMPONENTS_CSS: kitComponentsCss
    },
    output: 'standalone',
    trailingSlash: false,

    transpilePackages: ['@uiw/react-md-editor', 'leaflet', 'leaflet.heat'],

    // Type-check only the app sources during build, tests are covered by Jest
    typescript: {
        tsconfigPath: 'tsconfig.build.json'
    }
}

module.exports = nextConfig
