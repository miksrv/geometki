import React from 'react'

import { render, screen } from '@testing-library/react'

import { GamePoints } from './GamePoints'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

describe('GamePoints', () => {
    it('shows what an action gives with a plus, a score without one', () => {
        const { rerender } = render(
            <GamePoints
                value={30}
                plus={true}
            />
        )

        expect(screen.getByText('+30')).toBeInTheDocument()

        rerender(<GamePoints value={1250} />)

        expect(screen.getByText('1 250')).toBeInTheDocument()
    })

    it('names the number for screen readers and the hint, the figure itself hidden from them', () => {
        const { container } = render(
            <GamePoints
                value={30}
                plus={true}
                label={'30 очков за подтверждённый визит'}
            />
        )

        expect(container.firstElementChild).toHaveAttribute('title', '30 очков за подтверждённый визит')
        expect(screen.getByText('+30')).toHaveAttribute('aria-hidden', 'true')
        expect(screen.getByText('30 очков за подтверждённый визит')).toBeInTheDocument()
    })

    it('takes the look of where it is shown', () => {
        const { container, rerender } = render(<GamePoints value={5} />)

        expect(container.firstElementChild).toHaveClass('points', 'tint')

        rerender(
            <GamePoints
                value={5}
                variant={'cover'}
                size={'small'}
            />
        )

        expect(container.firstElementChild).toHaveClass('cover', 'small')
    })
})
