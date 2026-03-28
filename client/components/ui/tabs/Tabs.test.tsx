import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Tabs } from './Tabs'

// Mock simple-react-ui-kit Container (it's not under test here)
jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Container: ({ header, children, className }: any) => (
        <div className={className}>
            <div data-testid={'tabs-header'}>{header}</div>
            {children}
        </div>
    )
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

        it('renders children content', () => {
            render(
                <Tabs tabs={tabs}>
                    <div>Tab Content</div>
                </Tabs>
            )
            expect(screen.getByText('Tab Content')).toBeInTheDocument()
        })

        it('renders without tabs prop without crashing', () => {
            const { container } = render(<Tabs />)
            expect(container).toBeInTheDocument()
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
            const infoBtn = screen.getByRole('button', { name: 'Info' })
            expect(infoBtn).toHaveClass('active')
        })

        it('does not mark other tabs as active', () => {
            render(
                <Tabs
                    tabs={tabs}
                    activeTab={'info'}
                />
            )
            const photosBtn = screen.getByRole('button', { name: 'Photos' })
            expect(photosBtn).not.toHaveClass('active')
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
