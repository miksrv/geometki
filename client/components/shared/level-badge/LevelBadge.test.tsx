import React from 'react'

import { render, screen } from '@testing-library/react'

import { hexagonPath, LevelBadge } from './LevelBadge'

jest.mock('simple-react-ui-kit', () => ({
    useTooltip: (config: { content: string; describeTrigger: boolean } | null) => ({
        tooltip: config ? (
            <span
                data-tooltip={config.content}
                data-describe={String(config.describeTrigger)}
            />
        ) : null,
        triggerProps: {}
    })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (_key: string, opts: { defaultValue: string; level: number }) =>
            opts.defaultValue.replace('{{level}}', String(opts.level))
    })
}))

describe('LevelBadge', () => {
    it('draws the level in the colours of its tier and names it for screen readers', () => {
        const { container } = render(<LevelBadge level={11} />)

        const badge = screen.getByRole('img', { name: 'Уровень 11' })
        expect(badge).toHaveTextContent('11')

        // The make of an award: the rim, the field inside it, the number — in the tier's tokens
        const [rim, field] = container.querySelectorAll('path')
        expect(rim).toHaveStyle({ fill: 'var(--color-level-3-rim)' })
        expect(field).toHaveStyle({ fill: 'var(--color-level-3)' })
        expect(container.querySelector('text')).toHaveStyle({ fill: 'var(--color-level-3-ink)' })
    })

    it('keeps the hexagon proportions at any size', () => {
        render(<LevelBadge size={48} />)

        const badge = screen.getByRole('img', { name: 'Уровень 1' })
        expect(badge).toHaveAttribute('width', '50')
        expect(badge).toHaveAttribute('height', '57')
    })

    it('is flat: no gloss and no outline of the number', () => {
        const { container } = render(<LevelBadge level={1} />)

        expect(container.querySelector('linearGradient')).not.toBeInTheDocument()
        expect(container.querySelector('text')).not.toHaveAttribute('stroke')
    })

    it('adds a tooltip on request, not linked as a description of the already named badge', () => {
        const { container } = render(
            <LevelBadge
                level={5}
                showTooltip={true}
            />
        )

        expect(container.querySelector('[data-tooltip="Уровень 5"]')).toHaveAttribute('data-describe', 'false')
    })
})

describe('hexagonPath', () => {
    it('is a closed outline of six rounded corners', () => {
        const path = hexagonPath(3, 12)

        expect(path.startsWith('M')).toBe(true)
        expect(path.endsWith('Z')).toBe(true)
        expect(path.match(/Q/g)).toHaveLength(6)
    })
})
