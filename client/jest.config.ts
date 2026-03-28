import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
    collectCoverage: true,
    collectCoverageFrom: [
        '**/*.{js,jsx,ts,tsx}',
        '!**/*.d.ts',
        '!**/index.ts',
        '!**/types.ts',
        '!**/*.types.ts',
        '!**/middleware.ts',
        '!**/update.ts',
        '!**/store.ts',
        '!**/env.ts',
        '!**/node_modules/**',
        '!<rootDir>/out/**',
        '!<rootDir>/.next/**',
        '!<rootDir>/*.config.js',
        '!<rootDir>/*.config.ts',
        '!<rootDir>/coverage/**'
    ],
    coverageProvider: 'v8',
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.node.json'
        }
    },
    moduleNameMapper: {
        '^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$': 'identity-obj-proxy',

        // Handle CSS imports (with CSS modules)
        // https://jestjs.io/docs/webpack#mocking-css-modules
        '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',

        // Map ESM-only packages to their manual CJS mocks
        '^simple-react-ui-kit$': '<rootDir>/__mocks__/simple-react-ui-kit.tsx',

        // Handle module aliases
        '^@/(.*)$': '<rootDir>/$1',
        '^@/api/(.*)$': '<rootDir>/api/$1',
        '^@/components/(.*)$': '<rootDir>/components/$1',
        '^@/functions/(.*)$': '<rootDir>/functions/$1',
        '^@/utils/(.*)$': '<rootDir>/utils/$1',
        '^@/app/(.*)$': '<rootDir>/app/$1',
        '^@/public/(.*)$': '<rootDir>/public/$1',
        '^@/styles/(.*)$': '<rootDir>/styles/$1'
    },
    setupFilesAfterEnv: ['<rootDir>/setupTests.config.tsx'],
    silent: true, // hide all warnings
    testEnvironment: 'jsdom',
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
    transform: {
        // Use babel-jest to transpile tests with the next/babel preset
        // https://jestjs.io/docs/configuration#transform-objectstring-pathtotransformer--pathtotransformer-object
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
    },
    transformIgnorePatterns: ['/node_modules/', '^.+\\.module\\.(css|sass|scss)$']
}

export default config
