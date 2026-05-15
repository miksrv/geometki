import React from 'react'

import { render, screen } from '@testing-library/react'

import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
    it('renders children', () => {
        render(
            <Tooltip content={'Tooltip text'}>
                <button>Hover me</button>
            </Tooltip>
        )
        expect(screen.getByText('Hover me')).toBeInTheDocument()
    })

    it('renders tooltip content in the DOM', () => {
        render(
            <Tooltip content={'My tooltip'}>
                <span>Target</span>
            </Tooltip>
        )
        expect(screen.getByText('My tooltip')).toBeInTheDocument()
    })

    it('applies the top position class by default', () => {
        render(
            <Tooltip content={'tip'}>
                <span>Target</span>
            </Tooltip>
        )
        const tooltip = screen.getByText('tip')
        expect(tooltip.className).toContain('tooltip')
        expect(tooltip.className).toContain('top')
    })

    it('applies the bottom position class when position is bottom', () => {
        render(
            <Tooltip
                content={'tip'}
                position={'bottom'}
            >
                <span>Target</span>
            </Tooltip>
        )
        const tooltip = screen.getByText('tip')
        expect(tooltip.className).toContain('bottom')
    })

    it('applies the left position class when position is left', () => {
        render(
            <Tooltip
                content={'tip'}
                position={'left'}
            >
                <span>Target</span>
            </Tooltip>
        )
        expect(screen.getByText('tip').className).toContain('left')
    })

    it('applies the right position class when position is right', () => {
        render(
            <Tooltip
                content={'tip'}
                position={'right'}
            >
                <span>Target</span>
            </Tooltip>
        )
        expect(screen.getByText('tip').className).toContain('right')
    })

    it('applies a custom className to the wrapper', () => {
        const { container } = render(
            <Tooltip
                content={'tip'}
                className={'custom-class'}
            >
                <span>Target</span>
            </Tooltip>
        )
        const wrapper = container.firstChild as HTMLElement
        expect(wrapper.className).toContain('custom-class')
    })

    it('renders ReactNode content', () => {
        render(
            <Tooltip content={<strong>Bold tip</strong>}>
                <span>Target</span>
            </Tooltip>
        )
        expect(screen.getByText('Bold tip').tagName).toBe('STRONG')
    })
})
