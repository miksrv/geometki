import React from 'react'

import { render, screen } from '@testing-library/react'

import { QuestPointMark } from '../types'

import { QuestLayer } from './QuestLayer'

jest.mock('react-leaflet', () => ({
    Circle: () => null,
    Marker: () => null,
    Polyline: ({ pathOptions }: { pathOptions: { color: string } }) => (
        <i
            data-testid={'leg'}
            data-color={pathOptions.color}
        />
    ),
    Tooltip: () => null
}))

jest.mock('leaflet', () => ({
    __esModule: true,
    default: { DivIcon: jest.fn(), Icon: jest.fn() }
}))

const point = (id: string, state: QuestPointMark['state']): QuestPointMark => ({
    id,
    label: id,
    lat: 51.7,
    lon: 55.1,
    state
})

describe('QuestLayer', () => {
    it('draws a leg green between two confirmed points and blue to one still ahead', () => {
        render(
            <QuestLayer points={[point('1', 'done'), point('2', 'done'), point('3', 'current'), point('4', 'open')]} />
        )

        expect(screen.getAllByTestId('leg').map((leg) => leg.dataset.color)).toEqual(['#2f7d43', '#3770b1', '#3770b1'])
    })
})
