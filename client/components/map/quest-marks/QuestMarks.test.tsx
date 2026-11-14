import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { QuestMarks } from './QuestMarks'

const mockMarksQuery = jest.fn()

jest.mock('@/api', () => ({
    API: {
        useQuestsGetItemQuery: () => ({ data: undefined }),
        useQuestsGetMarksQuery: (...args: unknown[]) => mockMarksQuery(...args)
    }
}))

jest.mock('@/components/shared/quest-card', () => ({
    QuestCard: () => <div data-testid={'quest-card'} />
}))

jest.mock('simple-react-ui-kit', () => ({
    Skeleton: () => <div data-testid={'skeleton'} />
}))

jest.mock('react-leaflet', () => ({
    Marker: ({
        children,
        position,
        icon
    }: {
        children?: React.ReactNode
        position: [number, number]
        icon: { html: string }
    }) => (
        <div
            data-testid={'marker'}
            data-position={position.join(',')}
            data-icon={icon.html}
        >
            {children}
        </div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid={'popup'}>{children}</div>,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('leaflet', () => ({
    __esModule: true,
    default: {
        divIcon: (options: object) => ({ ...options })
    }
}))

const marks: ApiType.Game.QuestMark[] = [
    { id: 'q1', lat: 51.75, lon: 55.1, mode: 'steps', title: 'Космический Оренбург' },
    { id: 'q2', lat: 51.76, lon: 55.1, mode: 'riddles', title: 'Загадки старого центра' }
]

describe('QuestMarks', () => {
    beforeEach(() => mockMarksQuery.mockReset().mockReturnValue({ data: undefined }))

    it('pins the given quests, a flag in each and a question mark in a riddle one, and loads nothing', () => {
        render(<QuestMarks marks={marks} />)

        const markers = screen.getAllByTestId('marker')

        expect(markers).toHaveLength(2)
        expect(markers[0]).toHaveAttribute('data-position', '51.75,55.1')
        expect(markers[0].getAttribute('data-icon')).not.toContain('?</text>')
        expect(markers[1].getAttribute('data-icon')).toContain('?</text>')
        expect(screen.getByText('Космический Оренбург')).toBeInTheDocument()
        // The card is loaded only when its popup opens
        expect(screen.queryByTestId('quest-card')).not.toBeInTheDocument()
        expect(mockMarksQuery).toHaveBeenCalledWith(undefined, { skip: true })
    })

    it('is the layer of every quest without marks of its own', () => {
        mockMarksQuery.mockReturnValue({ data: { items: marks } })

        render(<QuestMarks />)

        expect(mockMarksQuery).toHaveBeenCalledWith(undefined, { skip: false })
        expect(screen.getAllByTestId('marker')).toHaveLength(2)
    })
})
