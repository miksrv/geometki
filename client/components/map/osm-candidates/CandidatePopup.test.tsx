import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

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

jest.mock('simple-react-ui-kit', () => ({
    Badge: ({ label, tooltip }: { label: string; tooltip?: string }) => <span title={tooltip}>{label}</span>,
    Button: ({ label, link, onClick }: { label?: string; link?: string; onClick?: () => void }) =>
        link ? (
            <a href={link}>{label}</a>
        ) : (
            <button
                type={'button'}
                onClick={onClick}
            >
                {label}
            </button>
        ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: () => null
}))

jest.mock('@/app/store', () => ({ useAppDispatch: () => jest.fn(), useAppSelector: () => true }))

const candidate = (overrides: Partial<ApiType.OsmCandidates.Candidate> = {}): ApiType.OsmCandidates.Candidate => ({
    breakdown: [
        { code: 'type', points: 1, value: 'historic=monument' },
        { code: 'nearbyWiki', distance: 0, points: 4, value: 'Памятник жертвам репрессий' }
    ],
    category: 'memorial',
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
    it('shows the place, its type, settlement and the facts about it without points', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.getByRole('heading', { name: 'Жертвам репрессий' })).toBeInTheDocument()
        expect(screen.getByText('Монумент')).toBeInTheDocument()
        expect(screen.getByText('в г. Самара')).toBeInTheDocument()
        expect(screen.getByText('Не открыто')).toHaveAttribute(
            'title',
            'Это место ещё никто не открыл на Геометках: оно есть в OpenStreetMap, но без описания'
        )
        expect(screen.getByText('Найдена статья в Википедии')).toBeInTheDocument()
        expect(screen.queryByText('Тип: Монумент')).not.toBeInTheDocument()
        expect(screen.queryByText('Рейтинг интереса')).not.toBeInTheDocument()
        expect(screen.queryByText('+4')).not.toBeInTheDocument()
        expect(screen.queryByText('Скрыть навсегда')).not.toBeInTheDocument()
    })

    it('does not repeat the Wikipedia fact next to the article link', () => {
        render(<CandidatePopup candidate={candidate({ breakdown: [{ code: 'wiki', points: 5 }] })} />)

        expect(screen.queryByText('Есть статья в Википедии')).not.toBeInTheDocument()
        expect(screen.getByText('Википедия')).toHaveAttribute('href', expect.stringContaining('ru.wikipedia.org'))
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

    it('marks cultural heritage and has no OSM or Wikidata link for a Wikidata-only object', () => {
        render(
            <CandidatePopup
                candidate={candidate({ heritage: '5610009000', osmId: null, osmType: null, source: 'wikidata' })}
            />
        )

        expect(screen.getByText('Наследие')).toHaveAttribute('title', 'Объект культурного наследия, № 5610009000')
        expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument()
        expect(screen.queryByText('Wikidata')).not.toBeInTheDocument()
    })

    it('links to the OSM object and never shows Wikidata', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.getByText('OpenStreetMap')).toHaveAttribute('href', 'https://www.openstreetmap.org/node/42')
        expect(screen.queryByText('Wikidata')).not.toBeInTheDocument()
    })

    it('links to the new place form prefilled from the candidate', () => {
        render(<CandidatePopup candidate={candidate()} />)

        expect(screen.getByText('Не открыто')).toBeInTheDocument()
        expect(screen.getByText(/Откройте это место первым: \+35 опыта/)).toBeInTheDocument()
        expect(screen.getByText('Добавить это место')).toHaveAttribute('href', '/places/create?candidate=cand123456789')
    })

    it('shows the place that looks like the candidate, with a link and no admin tools', () => {
        render(
            <CandidatePopup
                candidate={candidate({
                    place: { id: 'place12345678', similarity: 100, title: 'Памятник' },
                    status: 'duplicate'
                })}
            />
        )

        expect(screen.getByText('Похоже на геометку:')).toBeInTheDocument()
        expect(screen.getByText('Памятник')).toHaveAttribute('href', expect.stringContaining('place12345678'))
        expect(screen.queryByText(/Совпадение названия/)).not.toBeInTheDocument()
        expect(screen.queryByText('Подтвердить связь')).not.toBeInTheDocument()
    })

    it('has no create button for a linked candidate', () => {
        render(
            <CandidatePopup
                candidate={candidate({ place: { id: 'place12345678', title: 'Памятник' }, status: 'linked' })}
            />
        )

        expect(screen.getByText('Связано с геометкой:')).toBeInTheDocument()
        expect(screen.queryByText('Добавить это место')).not.toBeInTheDocument()
        expect(screen.queryByText('Отвязать')).not.toBeInTheDocument()
    })
})
