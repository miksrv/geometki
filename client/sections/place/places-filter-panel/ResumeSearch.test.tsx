import React from 'react'

import { render, screen } from '@testing-library/react'

import { ResumeSearch } from './ResumeSearch'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

jest.mock('next/image', () => {
    const Image = ({ alt }: any) => <img alt={alt} />
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, ...props }: any) => (
        <a
            href={href}
            {...props}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) =>
            typeof defaultValue === 'string'
                ? defaultValue.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''))
                : key
    })
}))

describe('ResumeSearch', () => {
    it('links to the last search', () => {
        render(<ResumeSearch lastSearch={{ href: '/places?category=cave', label: 'Пещеры' }} />)

        expect(screen.getByRole('link', { name: /Продолжить/ })).toHaveAttribute('href', '/places?category=cave')
    })
})
