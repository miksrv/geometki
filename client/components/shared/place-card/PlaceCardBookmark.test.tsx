import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import { useBookmark } from '@/components/shared/bookmark-button/useBookmark'

import { PlaceCardBookmark } from './PlaceCardBookmark'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-icon={name} />
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/api', () => ({
    API: { useBookmarksGetPlacesQuery: jest.fn() }
}))

jest.mock('@/app/store', () => ({
    useAppSelector: jest.fn()
}))

jest.mock('@/components/shared/bookmark-button/useBookmark', () => ({
    useBookmark: jest.fn()
}))

const mockAuth = (isAuth: boolean) =>
    (useAppSelector as jest.Mock).mockImplementation((selector) => selector({ auth: { isAuth } }))

const mockSaved = (data?: { items: string[] }, isLoading = false) =>
    (API.useBookmarksGetPlacesQuery as jest.Mock).mockReturnValue({ data, isLoading })

const toggle = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
    ;(useBookmark as jest.Mock).mockImplementation((placeId: string, known: boolean) => ({
        bookmarked: known,
        loading: false,
        toggle
    }))
})

describe('PlaceCardBookmark', () => {
    it('shows a guest the bookmark without asking for the bookmarks', () => {
        mockAuth(false)
        mockSaved()

        render(<PlaceCardBookmark placeId={'p1'} />)

        expect(API.useBookmarksGetPlacesQuery).toHaveBeenCalledWith(undefined, { skip: true })
        expect(useBookmark).toHaveBeenCalledWith('p1', false)
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })

    it('takes a signed-in visitor state from the bookmarked IDs over the list field', () => {
        mockAuth(true)
        mockSaved({ items: ['p1'] })

        render(
            <PlaceCardBookmark
                placeId={'p1'}
                known={false}
            />
        )

        expect(useBookmark).toHaveBeenCalledWith('p1', true)
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows the bookmark on a list without the field (feed, search, collections)', () => {
        mockAuth(true)
        mockSaved({ items: [] })

        render(<PlaceCardBookmark placeId={'p1'} />)

        expect(useBookmark).toHaveBeenCalledWith('p1', false)
        expect(screen.getByRole('button')).toBeEnabled()
    })

    it('uses the list field while the IDs load', () => {
        mockAuth(true)
        mockSaved(undefined, true)

        render(
            <PlaceCardBookmark
                placeId={'p1'}
                known={true}
            />
        )

        expect(useBookmark).toHaveBeenCalledWith('p1', true)
        expect(screen.getByRole('button')).toBeEnabled()
    })

    it('waits for the IDs when the list sent no field', () => {
        mockAuth(true)
        mockSaved(undefined, true)

        render(<PlaceCardBookmark placeId={'p1'} />)

        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('toggles without following the card link', () => {
        mockAuth(true)
        mockSaved({ items: [] })
        const onLinkClick = jest.fn()

        render(
            <div onClick={onLinkClick}>
                <PlaceCardBookmark placeId={'p1'} />
            </div>
        )

        fireEvent.click(screen.getByRole('button'))

        expect(toggle).toHaveBeenCalledTimes(1)
        expect(onLinkClick).not.toHaveBeenCalled()
    })
})
