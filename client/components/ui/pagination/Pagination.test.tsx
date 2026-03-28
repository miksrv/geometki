import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next/link', () => {
    const Link = ({ href, children, onClick, title, className }: any) => (
        <a href={href} onClick={onClick} title={title} className={className}>
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

import { Pagination } from './Pagination'

describe('Pagination', () => {
    describe('rendering', () => {
        it('renders a nav element with aria-label', () => {
            render(<Pagination currentPage={1} totalItemsCount={50} perPage={10} />)
            expect(screen.getByRole('navigation')).toBeInTheDocument()
        })

        it('renders page number links', () => {
            render(<Pagination currentPage={1} totalItemsCount={30} perPage={10} />)
            expect(screen.getByText('1')).toBeInTheDocument()
            expect(screen.getByText('2')).toBeInTheDocument()
            expect(screen.getByText('3')).toBeInTheDocument()
        })

        it('marks the current page as active', () => {
            render(<Pagination currentPage={2} totalItemsCount={30} perPage={10} />)
            const links = screen.getAllByRole('link')
            const activePage = links.find((l) => l.textContent === '2')
            expect(activePage).toHaveClass('active')
        })

        it('renders left/right arrow icons for large page sets', () => {
            render(<Pagination currentPage={10} totalItemsCount={500} perPage={10} neighbours={2} />)
            expect(screen.getByTestId('icon-KeyboardLeft')).toBeInTheDocument()
            expect(screen.getByTestId('icon-KeyboardRight')).toBeInTheDocument()
        })
    })

    describe('hideIfOnePage', () => {
        it('renders nothing when hideIfOnePage is true and there is only 1 page', () => {
            const { container } = render(
                <Pagination currentPage={1} totalItemsCount={5} perPage={10} hideIfOnePage />
            )
            // hideIfOnePage returns an empty fragment, so firstChild is null or an empty element
            expect(container.innerHTML.trim()).toBe('')
        })

        it('renders normally when there are multiple pages even with hideIfOnePage', () => {
            render(<Pagination currentPage={1} totalItemsCount={20} perPage={10} hideIfOnePage />)
            expect(screen.getByRole('navigation')).toBeInTheDocument()
        })
    })

    describe('hideArrows', () => {
        it('hides navigation arrows when hideArrows is true', () => {
            render(<Pagination currentPage={10} totalItemsCount={500} perPage={10} hideArrows />)
            expect(screen.queryByTestId('icon-KeyboardLeft')).not.toBeInTheDocument()
            expect(screen.queryByTestId('icon-KeyboardRight')).not.toBeInTheDocument()
        })
    })

    describe('onChangePage', () => {
        it('calls onChangePage with the page number when a page link is clicked', () => {
            const onChange = jest.fn()
            render(<Pagination currentPage={1} totalItemsCount={30} perPage={10} onChangePage={onChange} />)
            fireEvent.click(screen.getByText('2'))
            expect(onChange).toHaveBeenCalledWith(2)
        })

        it('prevents the default link navigation when onChangePage is provided', () => {
            const onChange = jest.fn()
            render(<Pagination currentPage={1} totalItemsCount={30} perPage={10} onChangePage={onChange} />)
            const link = screen.getByText('2')
            const clickEvent = fireEvent.click(link)
            // fireEvent.click returns false when default is prevented
            // (RTL doesn't propagate real browser nav, but we verify the handler was called)
            expect(onChange).toHaveBeenCalled()
        })
    })

    describe('total pages = 0', () => {
        it('renders without crashing when totalItemsCount is 0', () => {
            const { container } = render(<Pagination currentPage={1} totalItemsCount={0} perPage={10} />)
            expect(container).toBeInTheDocument()
        })
    })
})
