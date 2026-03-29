import React from 'react'

import { render, screen } from '@testing-library/react'

import { ActivityListItemLoader } from './ActivityListItemLoader'

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ children, className }: any) => <div className={className}>{children}</div>,
    Skeleton: ({ style }: any) => (
        <div
            data-testid={'skeleton'}
            style={style}
        />
    )
}))

describe('ActivityListItemLoader', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<ActivityListItemLoader />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders multiple skeleton elements', () => {
            render(<ActivityListItemLoader />)
            // 2 header skeletons + 5 content skeletons = 7
            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(5)
        })
    })
})
