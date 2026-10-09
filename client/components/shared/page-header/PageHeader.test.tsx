import React from 'react'

import { render, screen } from '@testing-library/react'

import { PageHeader } from './PageHeader'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key
    })
}))

jest.mock('@/components/ui', () => ({
    ExpandableText: ({ text, moreLabel }: any) => (
        <div>
            <p>{text}</p>
            <button>{moreLabel}</button>
        </div>
    ),
    Breadcrumbs: ({ links }: any) =>
        links?.length ? (
            <nav aria-label={'breadcrumb'}>
                {links.map((link: any) => (
                    <a
                        key={link.link}
                        href={link.link}
                    >
                        {link.text}
                    </a>
                ))}
            </nav>
        ) : null
}))

describe('PageHeader', () => {
    it('renders the title as the page h1', () => {
        render(<PageHeader title={'Места'} />)

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Места')
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('renders breadcrumbs above the title only when given', () => {
        render(
            <PageHeader
                title={'Закладки'}
                breadcrumbs={[{ link: '/users', text: 'Люди' }]}
            />
        )

        const nav = screen.getByRole('navigation', { name: 'breadcrumb' })
        const heading = screen.getByRole('heading', { level: 1 })

        expect(nav.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByRole('link', { name: 'Люди' })).toHaveAttribute('href', '/users')
    })

    it('renders description, leading and actions slots', () => {
        render(
            <PageHeader
                title={'Категории'}
                description={'Все категории мест'}
                leading={<span>avatar</span>}
                actions={<button>act</button>}
            />
        )

        expect(screen.getByText('Все категории мест')).toBeInTheDocument()
        expect(screen.getByText('avatar')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'act' })).toBeInTheDocument()
    })

    it('renders the lede with its "more" control and the aside block', () => {
        render(
            <PageHeader
                title={'Водопады'}
                description={'27 мест'}
                lede={'Водопады и каскады рек.'}
                aside={<div data-testid={'map'} />}
            />
        )

        expect(screen.getByText('27 мест')).toBeInTheDocument()
        expect(screen.getByText('Водопады и каскады рек.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Подробнее' })).toBeInTheDocument()
        expect(screen.getByTestId('map')).toBeInTheDocument()
    })
})
