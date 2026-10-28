import React from 'react'

import { render, screen } from '@testing-library/react'

import { HexLegend } from './HexLegend'

let mockUserId: string | undefined

jest.mock('@/app/store', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) =>
        selector({ auth: { user: mockUserId ? { id: mockUserId } : undefined } })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

describe('HexLegend', () => {
    it('names the three colours for a signed-in visitor', () => {
        mockUserId = 'u1'
        render(<HexLegend />)

        expect(screen.getAllByRole('listitem').map((el) => el.textContent)).toEqual([
            'hex_legend_visited',
            'hex_legend_places',
            'hex_legend_spots'
        ])
    })

    it('leaves out the visited colour for a guest', () => {
        mockUserId = undefined
        render(<HexLegend />)

        expect(screen.getAllByRole('listitem').map((el) => el.textContent)).toEqual([
            'hex_legend_places',
            'hex_legend_spots'
        ])
    })
})
