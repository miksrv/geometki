import React from 'react'

import { render, screen } from '@testing-library/react'

import { Breadcrumbs } from './Breadcrumbs'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/link', () => {
    const Link = ({ href, title, children }: any) => (
        <a
            href={href}
            title={title}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

describe('Breadcrumbs', () => {
    it('renders nothing without links', () => {
        const { container } = render(<Breadcrumbs links={[]} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('renders the trail as links inside a breadcrumb landmark', () => {
        render(
            <Breadcrumbs
                links={[
                    { link: '/users', text: 'Люди' },
                    { link: '/users/u1', text: 'Alice' }
                ]}
            />
        )

        expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument()
        expect(screen.getAllByRole('listitem')).toHaveLength(2)
        expect(screen.getByRole('link', { name: 'Люди' })).toHaveAttribute('href', '/users')
        expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/users/u1')
    })

    it('applies a custom className to the list', () => {
        render(
            <Breadcrumbs
                className={'custom'}
                links={[{ link: '/places', text: 'Места' }]}
            />
        )

        expect(screen.getByRole('list')).toHaveClass('custom')
    })
})
