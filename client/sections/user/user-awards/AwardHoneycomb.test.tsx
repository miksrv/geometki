import React from 'react'

import { render, screen } from '@testing-library/react'

import { AwardHoneycomb } from './AwardHoneycomb'

// jsdom has no layout: the block is as wide as the dialog of every award
jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(592)

const items = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
        key: `a${index}`,
        node: (size: number) => <span data-size={size}>{`award ${index}`}</span>
    }))

describe('AwardHoneycomb', () => {
    it('grows the hexagons so that five in a row and the shift fill the width', () => {
        render(
            <AwardHoneycomb
                columns={5}
                items={items(8)}
                aria-label={'Награды'}
            />
        )

        const cells = screen.getAllByRole('listitem')
        // (592 + 6) / 5.5 = 108.7 a step: 102.7px wide, 118px high
        expect(screen.getByText('award 0')).toHaveAttribute('data-size', '118')

        const left = (index: number) => parseFloat(cells[index].style.left)
        const top = (index: number) => parseFloat(cells[index].style.top)

        // The sixth starts the second row: shifted by half a step, less than a whole hexagon lower
        expect(top(4)).toBe(0)
        expect(left(5) - left(0)).toBeCloseTo((left(1) - left(0)) / 2)
        expect(top(5)).toBeGreaterThan(118 * 0.75)
        expect(top(5)).toBeLessThan(118)
    })

    it('keeps a single row unshifted', () => {
        render(
            <AwardHoneycomb
                columns={5}
                items={items(3)}
                aria-label={'Награды'}
            />
        )

        const list = screen.getByRole('list', { name: 'Награды' })

        expect(list).toHaveStyle({ height: '118px' })
        expect(screen.getAllByRole('listitem')[2]).toHaveStyle({ top: '0px' })
    })
})
