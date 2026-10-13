const { i18n } = require('./next-i18next.config.js')

/** @type {import('next').NextConfig} */
const nextConfig = {
    // The categories page is gone (the catalogue lives in the client, see CLAUDE.md →
    // Categories): its indexed URL goes to the places listing instead of a 404
    async redirects() {
        return [{ destination: '/places', permanent: true, source: '/categories' }]
    },
    // robots.txt and search consoles point to /sitemap.xml; the page is pages/sitemap.tsx.
    // On production nginx rewrites it too, this keeps it working without that (local, other
    // hosts). No `locale: false`: with it the destination misses the internal locale prefix and
    // 404s; /en/sitemap.xml serves the same document, both locales are in it
    async rewrites() {
        return [{ destination: '/sitemap', source: '/sitemap.xml' }]
    },
    // The service worker must not stay in the HTTP cache: a stale copy delays the next release
    async headers() {
        return [
            {
                headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
                source: '/sw.js'
            }
        ]
    },
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
    output: 'standalone',
    trailingSlash: false,

    transpilePackages: ['@uiw/react-md-editor', 'leaflet', 'leaflet.heat'],

    // Type-check only the app sources during build, tests are covered by Jest
    typescript: {
        tsconfigPath: 'tsconfig.build.json'
    }
}

module.exports = nextConfig
