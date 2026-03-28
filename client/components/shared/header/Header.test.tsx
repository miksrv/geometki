import React from 'react'

import { render, screen } from '@testing-library/react'

import { Header } from './Header'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Button: ({ icon, link, className }: any) => (
        <a
            href={link}
            className={className}
            data-icon={icon}
        >
            button
        </a>
    ),
    Container: ({ children, className }: any) => <div className={className}>{children}</div>
}))

jest.mock('@/components/ui', () => ({
    Breadcrumbs: ({ links }: any) => (
        <nav aria-label={'breadcrumb'}>
            {links?.map((l: any) => (
                <span key={l.link}>{l.label}</span>
            ))}
        </nav>
    )
}))

jest.mock('../user-avatar', () => ({
    UserAvatar: ({ user }: any) => <div data-testid={'user-avatar'}>{user?.name}</div>
}))

const mockUser = { id: 'user-1', name: 'Alice' }

describe('Header', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<Header />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders the title as h1', () => {
            render(<Header title={'My Page'} />)
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Page')
        })

        it('does not render back link when backLink is not provided', () => {
            render(<Header />)
            expect(screen.queryByText('button')).not.toBeInTheDocument()
        })

        it('renders back link when backLink is provided', () => {
            render(<Header backLink={'/places'} />)
            const link = screen.getByText('button')
            expect(link).toHaveAttribute('href', '/places')
        })

        it('renders UserAvatar when userData with id is provided', () => {
            render(<Header userData={mockUser as any} />)
            expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
        })

        it('does not render UserAvatar when userData has no id', () => {
            render(<Header userData={{ name: 'Ghost' } as any} />)
            expect(screen.queryByTestId('user-avatar')).not.toBeInTheDocument()
        })

        it('renders actions when provided', () => {
            render(<Header actions={<button>Action</button>} />)
            expect(screen.getByText('Action')).toBeInTheDocument()
        })

        it('does not render actions container when no actions', () => {
            const { container } = render(<Header />)
            expect(container.querySelector('.actions')).not.toBeInTheDocument()
        })
    })

    describe('attachedBottom prop', () => {
        it('applies attachedBottom class when prop is true', () => {
            const { container } = render(<Header attachedBottom />)
            expect(container.firstChild).toHaveClass('attachedBottom')
        })

        it('does not apply attachedBottom class by default', () => {
            const { container } = render(<Header />)
            expect(container.firstChild).not.toHaveClass('attachedBottom')
        })
    })

    describe('className prop', () => {
        it('applies custom className', () => {
            const { container } = render(<Header className={'custom-header'} />)
            expect(container.firstChild).toHaveClass('custom-header')
        })
    })
})
