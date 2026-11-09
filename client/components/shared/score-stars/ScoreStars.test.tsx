import React from 'react'

import { render, screen } from '@testing-library/react'

import { ScoreStars } from './ScoreStars'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | false | undefined>) => args.filter(Boolean).join(' '),
    Icon: ({ className }: { className?: string }) => (
        <i
            data-star={true}
            className={className}
        />
    )
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => `${key}:${String(options?.value)}`
    })
}))

describe('ScoreStars', () => {
    it('fills as many of the five stars as the score, rounding an average', () => {
        const { container, rerender } = render(<ScoreStars value={4} />)

        expect(screen.getByRole('img', { name: 'feed-score:4' })).toBeInTheDocument()
        expect(container.querySelectorAll('[data-star]')).toHaveLength(5)
        expect(container.querySelectorAll('.on')).toHaveLength(4)

        rerender(
            <ScoreStars
                value={3.6}
                size={'medium'}
                label={'Рейтинг 3,6 из 5'}
            />
        )

        expect(screen.getByRole('img', { name: 'Рейтинг 3,6 из 5' })).toHaveClass('medium')
        expect(container.querySelectorAll('.on')).toHaveLength(4)
    })

    it('is one star and the number in the single variant, as a place card tile', () => {
        const { container } = render(
            <ScoreStars
                value={5}
                variant={'single'}
            />
        )

        expect(screen.getByRole('img', { name: 'feed-score:5' })).toHaveTextContent('5')
        expect(container.querySelectorAll('[data-star]')).toHaveLength(1)
    })
})
