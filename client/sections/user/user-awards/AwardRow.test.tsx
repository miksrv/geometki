import React from 'react'

import { render, screen } from '@testing-library/react'

import { AwardRow } from './AwardRow'

const items = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
        key: `a${index}`,
        node: (size: number) => <span data-size={size}>{`award ${index}`}</span>,
        picture: () => <span>{`picture ${index}`}</span>
    }))

// jsdom has no layout: the row is as wide as the counters of a profile
jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(420)

const more = (hidden: number, _size: number, under?: React.ReactNode) => (
    <span>
        {under}
        {hidden ? `+${hidden}` : '···'}
    </span>
)

describe('AwardRow', () => {
    it('takes as many hexagons as fit at the smallest size and grows them to the width', () => {
        render(
            <AwardRow
                minSize={56}
                items={items(3)}
                more={more}
                aria-label={'Награды'}
            />
        )

        // 420px hold seven hexagons of 56px (48.5px wide and 6px between): each grows to 63px
        expect(screen.getByText('award 0')).toHaveAttribute('data-size', '63')
        // The last cell is always the way to every award: "···" when everything fits
        expect(screen.getAllByRole('listitem')).toHaveLength(4)
        expect(screen.getByText('···')).toBeInTheDocument()
    })

    it('gives the last cell to "+N", the first award not held seen under it', () => {
        render(
            <AwardRow
                minSize={56}
                items={items(12)}
                more={more}
                aria-label={'Награды'}
            />
        )

        // Six awards and the seventh cell: "+6" over the picture of the seventh award
        expect(screen.getAllByRole('listitem')).toHaveLength(7)
        expect(screen.getByText('+6')).toBeInTheDocument()
        expect(screen.getByText('picture 6')).toBeInTheDocument()
        expect(screen.queryByText('award 6')).not.toBeInTheDocument()
    })
})
