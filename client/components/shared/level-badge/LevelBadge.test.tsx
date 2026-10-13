import React from 'react'

import { render, screen } from '@testing-library/react'

import { LEVEL_COLORS } from '@/config/constants'

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

        const [shape] = container.querySelectorAll('path')
        expect(shape).toHaveAttribute('fill', LEVEL_COLORS[3].fill)
        expect(shape).toHaveAttribute('stroke', LEVEL_COLORS[3].border)
    })

    it('keeps the hexagon proportions at any size', () => {
        render(<LevelBadge size={48} />)

        const badge = screen.getByRole('img', { name: 'Уровень 1' })
        expect(badge).toHaveAttribute('width', '50')
        expect(badge).toHaveAttribute('height', '57')
    })

    it('gives every badge its own gradient id', () => {
        const { container } = render(
            <>
                <LevelBadge level={1} />
                <LevelBadge level={2} />
            </>
        )

        const ids = [...container.querySelectorAll('linearGradient')].map((node) => node.id)
        expect(new Set(ids).size).toBe(2)
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
