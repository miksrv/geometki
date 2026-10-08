import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { Tabs } from './Tabs'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | false | undefined>) => args.filter(Boolean).join(' ')
}))

const tabs = [
    { key: 'info', label: 'Info' },
    { key: 'photos', label: 'Photos' }
]

describe('Tabs', () => {
    describe('rendering', () => {
        it('renders all tab labels', () => {
            render(<Tabs tabs={tabs} />)
            expect(screen.getByText('Info')).toBeInTheDocument()
            expect(screen.getByText('Photos')).toBeInTheDocument()
        })

        it('renders a labelled navigation landmark', () => {
            render(
                <Tabs
                    tabs={tabs}
                    aria-label={'Profile'}
                />
            )
            expect(screen.getByRole('navigation', { name: 'Profile' })).toBeInTheDocument()
        })

        it('renders without tabs prop without crashing', () => {
            const { container } = render(<Tabs />)
            expect(container).toBeInTheDocument()
        })

        it('renders links for tabs with href', () => {
            render(
                <Tabs
                    tabs={tabs.map((tab) => ({ ...tab, href: `/${tab.key}` }))}
                    activeTab={'photos'}
                />
            )
            expect(screen.getByRole('link', { name: 'Info' })).toHaveAttribute('href', '/info')
            expect(screen.getByRole('link', { name: 'Photos' })).toHaveAttribute('aria-current', 'page')
        })
    })

    describe('active tab', () => {
        it('marks the active tab button with active class', () => {
            render(
                <Tabs
                    tabs={tabs}
                    activeTab={'info'}
                />
            )
            expect(screen.getByRole('button', { name: 'Info' })).toHaveClass('active')
        })

        it('does not mark other tabs as active', () => {
            render(
                <Tabs
                    tabs={tabs}
                    activeTab={'info'}
                />
            )
            expect(screen.getByRole('button', { name: 'Photos' })).not.toHaveClass('active')
        })
    })

    describe('overflow fade', () => {
        const setSizes = (el: HTMLElement, { scrollLeft = 0, clientWidth = 100, scrollWidth = 300 }) => {
            Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth })
            Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth })
            el.scrollLeft = scrollLeft
        }

        it('fades the edges that have hidden tabs behind them', () => {
            render(
                <Tabs
                    tabs={tabs}
                    aria-label={'Profile'}
                />
            )
            const nav = screen.getByRole('navigation')
            const list = nav.firstElementChild as HTMLElement

            setSizes(list, { scrollLeft: 0 })
            fireEvent.scroll(list)
            expect(nav).toHaveClass('fadeEnd')
            expect(nav).not.toHaveClass('fadeStart')

            setSizes(list, { scrollLeft: 100 })
            fireEvent.scroll(list)
            expect(nav).toHaveClass('fadeStart')
            expect(nav).toHaveClass('fadeEnd')

            setSizes(list, { scrollLeft: 200 })
            fireEvent.scroll(list)
            expect(nav).toHaveClass('fadeStart')
            expect(nav).not.toHaveClass('fadeEnd')
        })

        it('has no fade when all tabs fit', () => {
            render(<Tabs tabs={tabs} />)
            const nav = screen.getByRole('navigation')
            const list = nav.firstElementChild as HTMLElement

            setSizes(list, { clientWidth: 300, scrollWidth: 300 })
            act(() => {
                window.dispatchEvent(new Event('resize'))
            })
            expect(nav).not.toHaveClass('fadeStart')
            expect(nav).not.toHaveClass('fadeEnd')
        })
    })

    describe('interaction', () => {
        it('calls onChangeTab with the correct key when a tab is clicked', () => {
            const handleChange = jest.fn()
            render(
                <Tabs
                    tabs={tabs}
                    onChangeTab={handleChange}
                />
            )
            fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
            expect(handleChange).toHaveBeenCalledWith('photos')
        })
    })
})
