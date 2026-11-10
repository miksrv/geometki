import React from 'react'

import { render, screen } from '@testing-library/react'

import { FeedStoryLoader } from './FeedStoryLoader'

jest.mock('simple-react-ui-kit', () => ({
    Skeleton: ({ className }: { className?: string }) => (
        <div
            data-testid={'skeleton'}
            className={className}
        />
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

describe('FeedStoryLoader', () => {
    it('is a card with a media block in the full feed', () => {
        render(<FeedStoryLoader />)

        expect(screen.getByTestId('feed-story-loader')).not.toHaveClass('compact')
        expect(screen.getAllByTestId('skeleton')).toHaveLength(4)
    })

    it('is a compact line without a card or media in a compact list', () => {
        render(<FeedStoryLoader density={'compact'} />)

        expect(screen.getByTestId('feed-story-loader')).toHaveClass('compact')
        expect(screen.getAllByTestId('skeleton')).toHaveLength(3)
    })
})
