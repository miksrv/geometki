import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PlacesList } from './PlacesList'

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ children, className }: any) => <div className={className}>{children}</div>
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('./PlacesListItem', () => ({
    PlacesListItem: ({ place }: any) => <div data-testid={'places-list-item'}>{place.title}</div>
}))

jest.mock('./PlacesListItemLoader', () => ({
    PlacesListItemLoader: () => <div data-testid={'places-loader'} />
}))

const mockPlaces: ApiModel.Place[] = [
    { id: 'place-1', title: 'Cool Cave', lat: 55.0, lon: 37.0 },
    { id: 'place-2', title: 'Mountain Peak', lat: 56.0, lon: 38.0 }
]

describe('PlacesList', () => {
    describe('rendering', () => {
        it('renders place items when places are provided', () => {
            render(<PlacesList places={mockPlaces} />)
            expect(screen.getAllByTestId('places-list-item')).toHaveLength(2)
        })

        it('renders place titles', () => {
            render(<PlacesList places={mockPlaces} />)
            expect(screen.getByText('Cool Cave')).toBeInTheDocument()
            expect(screen.getByText('Mountain Peak')).toBeInTheDocument()
        })

        it('renders empty state when no places and not loading', () => {
            render(<PlacesList />)
            expect(screen.getByText('nothing-here-yet')).toBeInTheDocument()
        })

        it('does not render the section when places is empty', () => {
            const { container } = render(<PlacesList places={[]} />)
            expect(container.querySelector('section')).not.toBeInTheDocument()
        })

        it('renders 3 loader items when loading is true', () => {
            render(<PlacesList loading={true} />)
            expect(screen.getAllByTestId('places-loader')).toHaveLength(3)
        })

        it('does not render empty state when loading', () => {
            render(<PlacesList loading={true} />)
            expect(screen.queryByText('nothing-here-yet')).not.toBeInTheDocument()
        })

        it('renders places section when places are provided', () => {
            const { container } = render(<PlacesList places={mockPlaces} />)
            expect(container.querySelector('section')).toBeInTheDocument()
        })
    })
})
