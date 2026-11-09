import React from 'react'

import { render } from '@testing-library/react'

import { ToneBadge, toneBadgeHtml } from './ToneBadge'

describe('ToneBadge', () => {
    it('tells the tone by a glyph as well as a colour, the same on the marker and in a chip', () => {
        const { container } = render(<ToneBadge tone={'visited'} />)
        const badge = container.firstElementChild

        expect(badge).toHaveClass('badge', 'visited')
        expect(badge).toHaveAttribute('aria-hidden', 'true')
        expect(badge?.querySelector('svg path')).toBeInTheDocument()

        const html = toneBadgeHtml('visited')

        expect(html).toContain('onMarker')
        expect(html).toContain(badge?.querySelector('path')?.getAttribute('d') ?? 'none')
    })

    it('has a glyph of its own for each tone', () => {
        const glyph = (tone: 'visited' | 'bookmark') => toneBadgeHtml(tone).replace(/class="[^"]*"/, '')

        expect(glyph('visited')).not.toBe(glyph('bookmark'))
    })
})
