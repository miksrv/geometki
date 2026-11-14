import React from 'react'

import { render } from '@testing-library/react'

import { AchievementIcon } from './AchievementIcon'
import { AwardBadge, awardSymbol } from './AwardBadge'

jest.mock('next/image', () => {
    const Image = ({ src, alt }: { src: string; alt: string }) => (
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.test/'
}))

describe('AwardBadge', () => {
    it('picks the symbol by the group, then by the category', () => {
        expect(awardSymbol('season-2027-warm', 'seasonal')).toBe('warm')
        expect(awardSymbol('season-2026-cold', 'seasonal')).toBe('cold')
        expect(awardSymbol('wayfarer', 'game')).toBe('quest')
        expect(awardSymbol('pathfinder', 'game')).toBe('pin')
        expect(awardSymbol('photographer', 'content')).toBe('camera')
        expect(awardSymbol(undefined, undefined)).toBe('star')
    })

    it('draws the rim by the tier and the field by the group', () => {
        const { container, rerender } = render(
            <AwardBadge
                size={48}
                tier={'gold'}
                category={'game'}
                group={'pathfinder'}
            />
        )
        const badge = container.querySelector('svg')

        expect(badge).toHaveClass('tier-gold', 'field-game')
        expect(badge).toHaveAttribute('height', '48')
        expect(badge).toHaveAttribute('aria-hidden', 'true')

        // A season's field is warm or cold, its rim dark steel: a season has no tiers
        rerender(
            <AwardBadge
                size={48}
                category={'seasonal'}
                group={'season-2026-cold'}
            />
        )

        expect(container.querySelector('svg')).toHaveClass('tier-none', 'field-cold')

        // Every quest award is orange, whatever its category
        rerender(
            <AwardBadge
                size={48}
                tier={'bronze'}
                category={'game'}
                group={'wayfarer'}
            />
        )

        expect(container.querySelector('svg')).toHaveClass('tier-bronze', 'field-quest')
    })
})

describe('AchievementIcon', () => {
    it('shows the drawn picture of an award when it has one', () => {
        const { container } = render(
            <AchievementIcon
                image={'uploads/achievements/a.png'}
                alt={'Следопыт'}
                size={48}
            />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/uploads/achievements/a.png')
        expect(container.querySelector('svg')).not.toBeInTheDocument()
    })

    it('draws a badge for an award without a picture', () => {
        const { container } = render(
            <AchievementIcon
                size={48}
                tier={'silver'}
                category={'game'}
                group={'pathfinder'}
            />
        )

        expect(container.querySelector('img')).not.toBeInTheDocument()
        expect(container.querySelector('svg')).toHaveClass('award', 'tier-silver')
    })
})
