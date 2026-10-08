import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ApiType } from '@/api'

import { CandidatePopup } from './CandidatePopup'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) =>
            String(opts?.defaultValue ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(opts?.[name] ?? ''))
    })
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
}))

jest.mock('next/dynamic', () => ({
    __esModule: true,
    default: () =>
        function ConfirmationDialog({
            open,
            message,
            confirmLabel,
            onConfirm
        }: {
            open: boolean
            message: string
            confirmLabel: string
            onConfirm: () => void
        }) {
            return open ? (
                <div role={'dialog'}>
                    {message}
                    <button onClick={onConfirm}>{confirmLabel}</button>
                </div>
            ) : null
        }
}))

jest.mock('simple-react-ui-kit', () => ({
    Badge: ({ label, tooltip }: { label: string; tooltip?: string }) => <span title={tooltip}>{label}</span>,
    Button: ({
        label,
        link,
        type,
        disabled,
        onClick
    }: {
        label?: string
        link?: string
        type?: 'submit'
        disabled?: boolean
        onClick?: () => void
    }) =>
        link ? (
            <a href={link}>{label}</a>
        ) : (
            <button
                type={type ?? 'button'}
                disabled={disabled}
                onClick={onClick}
            >
                {label}
            </button>
        ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: () => null
}))

jest.mock('@/app/store', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('@/app/notificationSlice', () => ({ Notify: jest.fn() }))

const mockLink = jest.fn()
const mockUnlink = jest.fn()
const mockReject = jest.fn()

const mutation = (fn: jest.Mock) => [
    (arg: unknown) => {
        fn(arg)
        return { unwrap: () => Promise.resolve() }
    },
    { isLoading: false }
]

jest.mock('@/api', () => ({
    API: {
        useOsmCandidatesPatchLinkMutation: () => mutation(mockLink),
        useOsmCandidatesPatchRejectMutation: () => mutation(mockReject),
        useOsmCandidatesPatchUnlinkMutation: () => mutation(mockUnlink)
    }
}))

const candidate = (overrides: Partial<ApiType.OsmCandidates.Candidate> = {}): ApiType.OsmCandidates.Candidate => ({
    breakdown: [
        { code: 'type', points: 1, value: 'historic=monument' },
        { code: 'nearbyWiki', distance: 0, points: 4, value: 'Памятник жертвам репрессий' }
    ],
    category: 'monument',
    ele: null,
    heritage: null,
    id: 'cand123456789',
    image: null,
    lat: 53.23,
    lon: 50.19,
    name: 'Жертвам репрессий',
    osmId: 42,
    osmTag: 'historic=monument',
    osmType: 'node',
    photos: [],
    place: null,
    score: 11,
    settlement: { distance: 0, name: 'Самара', type: 'city' },
    size: null,
    source: 'osm',
    status: 'open',
    tier: 'known',
    typeTitle: 'Монумент',
    wikidata: 'Q1',
    wikipedia: 'ru:Памятник',
    ...overrides
})

const photo = {
    author: 'Kagul',
    file: 'Salionka.jpg',
    license: 'Public domain',
    licenseUrl: null,
    page: 'https://commons.wikimedia.org/wiki/File:Salionka.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Salionka.jpg'
}

describe('CandidatePopup', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the place, its type, settlement and why it got its rating', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.getByRole('heading', { name: 'Жертвам репрессий' })).toBeInTheDocument()
        expect(screen.getByText('Монумент')).toBeInTheDocument()
        expect(screen.getByText('в г. Самара')).toBeInTheDocument()
        expect(screen.getByText('Хорошо описанные')).toHaveAttribute(
            'title',
            'О месте много известно: есть статья, фото или охранный статус'
        )
        expect(screen.getByText('Рейтинг интереса')).toBeInTheDocument()
        expect(screen.getByText('11')).toBeInTheDocument()
        expect(screen.getByText('Найдена статья в Википедии: Памятник жертвам репрессий')).toBeInTheDocument()
        expect(screen.getByText('+4')).toBeInTheDocument()
    })

    it('shows the elevation in meters, never in kilometers', () => {
        render(<CandidatePopup candidate={candidate({ ele: 1639.6, typeTitle: 'Вершина' })} />)

        expect(screen.getByText('Вершина · 1640 м')).toBeInTheDocument()
    })

    it('tells that the name is unknown and does not repeat the type of an unnamed object', () => {
        render(<CandidatePopup candidate={candidate({ name: null, typeTitle: 'Пещера' })} />)

        expect(screen.getByRole('heading', { name: 'Пещера в г. Самара' })).toBeInTheDocument()
        expect(screen.getByText('Название неизвестно')).toBeInTheDocument()
    })

    it('has no rating block without a breakdown', () => {
        render(<CandidatePopup candidate={candidate({ breakdown: [] })} />)

        expect(screen.queryByText('Рейтинг интереса')).not.toBeInTheDocument()
    })

    it('shows a Commons photo only with its author and licence', () => {
        render(<CandidatePopup candidate={candidate({ photos: [photo, { ...photo, file: 'Other.jpg' }] })} />)

        expect(screen.getByRole('img')).toHaveAttribute('src', photo.url)
        expect(screen.getByText('Kagul · Public domain · Wikimedia Commons')).toHaveAttribute('href', photo.page)
        expect(screen.getByLabelText('ещё фото: 1')).toHaveTextContent('+1')
    })

    it('shows an OSM image without credits and drops a broken cover', () => {
        const { container } = render(
            <CandidatePopup candidate={candidate({ image: 'https://example.com/photo.jpg' })} />
        )

        expect(screen.queryByText(/Wikimedia Commons/)).not.toBeInTheDocument()

        fireEvent.error(screen.getByRole('img'))

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(container.querySelector('article')).toHaveClass('noCover')
    })

    it('marks cultural heritage and has no OSM link for a Wikidata-only object', () => {
        render(
            <CandidatePopup
                candidate={candidate({ heritage: '5610009000', osmId: null, osmType: null, source: 'wikidata' })}
            />
        )

        expect(screen.getByText('Наследие')).toHaveAttribute('title', 'Объект культурного наследия, № 5610009000')
        expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument()
        expect(screen.getByText('Wikidata')).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q1')
    })

    it('links to the OSM object with a short label', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.getByText('OSM')).toHaveAttribute('href', 'https://www.openstreetmap.org/node/42')
    })

    it('has no sources block without sources', () => {
        const { container } = render(
            <CandidatePopup candidate={candidate({ osmId: null, osmType: null, wikidata: null, wikipedia: null })} />
        )

        expect(container.querySelector('footer')).not.toBeInTheDocument()
    })

    it('links to the new place form prefilled from the candidate', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.getByText('Создать геометку')).toHaveAttribute('href', '/places/create?candidate=cand123456789')
    })

    it('has no admin tools for users', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.queryByText('Скрыть навсегда')).not.toBeInTheDocument()
        expect(screen.queryByText('historic=monument')).not.toBeInTheDocument()
    })

    it('lets an admin confirm a found duplicate', async () => {
        const duplicate = candidate({
            place: { id: 'place12345678', similarity: 100, title: 'Памятник' },
            status: 'duplicate'
        })

        render(
            <CandidatePopup
                candidate={duplicate}
                isAdmin={true}
            />
        )

        expect(screen.getByText('Памятник')).toHaveAttribute('href', expect.stringContaining('place12345678'))
        expect(screen.getByText('Совпадение названия: 100%')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Подтвердить связь'))
        expect(mockLink).toHaveBeenCalledWith({ id: 'cand123456789', placeId: 'place12345678' })
        await waitFor(() => expect(screen.getByText('Подтвердить связь')).toBeEnabled())
    })

    it('lets an admin unlink and has no create button for a linked candidate', async () => {
        render(
            <CandidatePopup
                candidate={candidate({ place: { id: 'place12345678', title: 'Памятник' }, status: 'linked' })}
                isAdmin={true}
            />
        )

        expect(screen.queryByText('Создать геометку')).not.toBeInTheDocument()
        expect(screen.getByText('Связано с геометкой:')).toBeInTheDocument()
        expect(screen.queryByText('Связать')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Отвязать'))
        expect(mockUnlink).toHaveBeenCalledWith('cand123456789')
        await waitFor(() => expect(screen.getByText('Отвязать')).toBeEnabled())
    })

    it('asks an admin before hiding a candidate for good', async () => {
        render(
            <CandidatePopup
                candidate={candidate()}
                isAdmin={true}
            />
        )

        expect(screen.queryByPlaceholderText('Ссылка или ID геометки')).not.toBeInTheDocument()
        expect(screen.queryByText('historic=monument')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Скрыть навсегда'))
        expect(mockReject).not.toHaveBeenCalled()
        expect(screen.getByRole('dialog')).toHaveTextContent('Скрыть «Жертвам репрессий» с карты навсегда?')

        fireEvent.click(screen.getByText('Скрыть'))
        expect(mockReject).toHaveBeenCalledWith('cand123456789')
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
})
