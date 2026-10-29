import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconTypes } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import useSearchHistory, { SearchHistoryEntry } from '@/hooks/useSearchHistory'
import useUserLocation from '@/hooks/useUserLocation'
import { getCategoryShortTitle } from '@/utils/categories'
import { buildLocationHref, buildPlaceUrl, getLandingFlags } from '@/utils/helpers'

/** The server suggests nothing for fewer letters */
export const SEARCH_MIN_LENGTH = 3
const DEBOUNCE_MS = 250
/** Russia: "Популярные регионы" are the fullest regions of the site's home country */
const HOME_COUNTRY_ID = 1
const POPULAR_REGIONS_LIMIT = 5

export type SiteSearchIcon = { name: IconTypes } | { category?: ApiModel.Categories | null }

export interface SiteSearchItem {
    key: string
    label: string
    caption?: string
    icon: SiteSearchIcon
    /** The tile in `--color-main`: the suggested action */
    accent?: boolean
    /** Mark the words of the query in the label */
    highlight?: boolean
    /** Where the row leads; a row without it runs `action` */
    href?: string
    action?: () => Promise<void>
    /** Remembered in "Недавние" once opened */
    history?: SearchHistoryEntry
}

export interface SiteSearchSection {
    key: string
    /** The overline above the group */
    label?: string
    items: SiteSearchItem[]
    /** "Очистить" next to the label */
    onClear?: () => void
}

const ofType =
    <T extends ApiType.Search.Suggestion['type']>(type: T) =>
    (item: ApiType.Search.Suggestion): item is Extract<ApiType.Search.Suggestion, { type: T }> =>
        item.type === type

const mapHref = (lat: number, lon: number, zoom: number) => `/map#${lat},${lon},${zoom}?m=${lat},${lon}`

/**
 * The site search behind `SiteSearch` (the app bar, the home page hero): what to show for the
 * typed text — before anything is typed "Места рядом", the recent searches and the fullest
 * regions; then the query itself (opens `/search`), the point of typed coordinates, places,
 * the site's regions and cities (their places listing) and addresses on the map.
 *
 * `open` asks for the zero-state data only once the panel is opened. Returns the sections, the
 * flat list of their rows (for the keyboard), `select(item)` and `submit()` (Enter on the text).
 */
const useSiteSearch = (open: boolean) => {
    const { t } = useTranslation()
    const router = useRouter()

    // `?q=a&q=b` comes as an array: the first one, like the search page reads it
    const rawQuery = router.query.q
    const urlQuery = router.pathname === '/search' ? ((Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? '') : ''
    const [query, setQuery] = useState<string>(urlQuery)
    const [debounced, setDebounced] = useState<string>(urlQuery.trim())

    // After every navigation the field shows the query of the search page, elsewhere it is empty;
    // a filter or tab of the search page keeps `q` and leaves the text being typed alone
    const shownUrlQuery = useRef(urlQuery)
    useEffect(() => {
        if (router.pathname === '/search' && shownUrlQuery.current === urlQuery) {
            return
        }

        shownUrlQuery.current = urlQuery
        setQuery(urlQuery)
    }, [router.asPath])

    const text = query.trim()

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(text), DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [text])

    const history = useSearchHistory()
    const { request: requestLocation } = useUserLocation()

    const isTyping = text.length >= SEARCH_MIN_LENGTH
    const { data, isFetching } = API.useSearchSuggestQuery(debounced, {
        skip: !open || debounced.length < SEARCH_MIN_LENGTH
    })
    const { data: regions } = API.useLocationsGetChildrenQuery(
        { id: HOME_COUNTRY_ID, type: 'country' },
        { skip: !open || isTyping }
    )

    // Another field of the page (the hero and the app bar) may have added to the history
    useEffect(() => {
        if (open) {
            history.refresh()
        }
    }, [open])

    const flags = getLandingFlags()
    // The answer to the text on screen; the previous one stays while the next is on its way
    const suggestions = useMemo(() => (isTyping ? (data?.suggestions ?? []) : []), [isTyping, data])
    const loading = isTyping && (isFetching || debounced !== text)

    const sections = useMemo<SiteSearchSection[]>(() => {
        if (!isTyping) {
            const words = text.toLowerCase()
            const recent = history.entries.filter((entry) => !words || entry.label.toLowerCase().includes(words))

            const zero: SiteSearchSection[] = [
                {
                    items: text
                        ? []
                        : [
                              {
                                  accent: true,
                                  action: async () => {
                                      const location = await requestLocation()

                                      if (location) {
                                          // TEMPORARILY OFF (1.17.5): no point in the URL (proxy.ts redirects it),
                                          // the list sorts by distance from the location cookie just saved
                                          // await router.push(
                                          //     `/places?lat=${location.lat}&lon=${location.lon}&sort=distance&order=ASC`
                                          // )
                                          await router.push('/places?sort=distance&order=ASC')
                                      }
                                  },
                                  caption: t('location-near-caption', 'Сначала ближайшие'),
                                  icon: { name: 'Position' },
                                  key: 'near',
                                  label: t('search-near', 'Места рядом со мной')
                              }
                          ],
                    key: 'actions'
                },
                {
                    items: recent.map((entry) => ({
                        caption: entry.kind === 'query' ? undefined : entry.caption,
                        highlight: !!words,
                        history: entry,
                        href: entry.kind === 'query' ? `/search?q=${encodeURIComponent(entry.label)}` : entry.href,
                        icon:
                            entry.kind === 'place'
                                ? { category: entry.category }
                                : { name: entry.kind === 'query' ? 'Time' : entry.kind === 'area' ? 'Point' : 'Map' },
                        key: history.keyOf(entry),
                        label: entry.label
                    })),
                    key: 'recent',
                    label: t('location-group-recent', 'Недавние'),
                    onClear: words ? undefined : history.clear
                },
                {
                    items: text
                        ? []
                        : [...(regions?.items ?? [])]
                              .sort((a, b) => b.placesCount - a.placesCount)
                              .slice(0, POPULAR_REGIONS_LIMIT)
                              .map((region) => {
                                  const href = buildLocationHref(region, flags)
                                  const caption = t('places-count', '{{count}} мест', { count: region.placesCount })

                                  return {
                                      caption,
                                      history: { caption, href, kind: 'area', label: region.title },
                                      href,
                                      icon: { name: 'Point' },
                                      key: `region:${region.id}`,
                                      label: region.title
                                  }
                              }),
                    key: 'regions',
                    label: t('location-group-popular', 'Популярные регионы')
                }
            ]

            return zero.filter((section) => section.items.length)
        }

        const coordinates = suggestions.filter(ofType('coordinates'))
        const places = suggestions.filter(ofType('place'))
        const areas = suggestions.filter(ofType('area'))
        const addresses = suggestions.filter(ofType('location'))

        const found: SiteSearchSection[] = [
            {
                items: [
                    {
                        accent: true,
                        caption: t('search-all-caption', 'Все места, адреса и координаты'),
                        href: `/search?q=${encodeURIComponent(text)}`,
                        icon: { name: 'Search' },
                        key: 'all',
                        label: t('search-all', 'Искать «{{query}}»', { query: text })
                    },
                    ...coordinates.map(({ lat, lon }): SiteSearchItem => ({
                        caption: t('search-point-caption', 'Точка на карте'),
                        href: mapHref(lat, lon, 14),
                        icon: { name: 'PinDrop' },
                        key: `point:${lat},${lon}`,
                        label: `${lat}, ${lon}`
                    }))
                ],
                key: 'query'
            },
            {
                items: places.map((place) => {
                    const href = buildPlaceUrl(place.id, place.slug)
                    const caption = [place.category ? getCategoryShortTitle(t, place.category) : '', place.address]
                        .filter(Boolean)
                        .join(' · ')

                    return {
                        caption,
                        highlight: true,
                        history: { caption, category: place.category, href, kind: 'place', label: place.title },
                        href,
                        icon: { category: place.category },
                        key: `place:${place.id}`,
                        label: place.title
                    }
                }),
                key: 'places',
                label: t('search-group-places', 'Места')
            },
            {
                items: areas.map((area) => {
                    const href = buildLocationHref({ id: area.id, slug: area.slug, type: area.locationType }, flags)
                    const caption = [area.region, t('places-count', '{{count}} мест', { count: area.placesCount })]
                        .filter(Boolean)
                        .join(' · ')

                    return {
                        caption,
                        highlight: true,
                        history: { caption, href, kind: 'area', label: area.title },
                        href,
                        icon: { name: 'Point' },
                        key: `area:${area.locationType}:${area.id}`,
                        label: area.title
                    }
                }),
                key: 'areas',
                label: t('search-group-areas', 'Регионы и города')
            },
            {
                items: addresses.map((address) => {
                    const href = mapHref(address.lat, address.lon, 12)
                    const caption = address.secondary ?? t('search-point-caption', 'Точка на карте')

                    return {
                        caption,
                        highlight: true,
                        history: { caption, href, kind: 'address', label: address.title },
                        href,
                        icon: { name: 'Map' },
                        key: `address:${address.lat},${address.lon}`,
                        label: address.title
                    }
                }),
                key: 'addresses',
                label: t('search-group-addresses', 'На карте')
            }
        ]

        return found.filter((section) => section.items.length)
    }, [isTyping, text, suggestions, history.entries, regions, t])

    const items = useMemo(() => sections.flatMap((section) => section.items), [sections])

    const hint = useMemo(() => {
        if (text && !isTyping) {
            return t('search-hint', 'Введите хотя бы три символа')
        }

        if (isTyping && !loading && data && !suggestions.length) {
            return t('search-no-suggestions', 'Подсказок нет — проверьте написание или введите координаты')
        }

        return undefined
    }, [text, isTyping, loading, data, suggestions.length])

    const navigate = useCallback(
        async (href: string) => {
            // The map is already open: move it, without a new history entry
            if (href.startsWith('/map#') && router.pathname === '/map') {
                await router.replace({ hash: href.slice('/map#'.length), pathname: '/map' })
                return
            }

            await router.push(href)
        },
        [router]
    )

    /** Opens a row: remembers it, then follows its link or runs its action */
    const select = useCallback(
        async (item: SiteSearchItem, { follow = true }: { follow?: boolean } = {}) => {
            if (item.history) {
                history.remember(item.history)
            } else if (item.key === 'all') {
                history.remember({ kind: 'query', label: text })
            }

            if (!follow) {
                return
            }

            if (item.action) {
                await item.action()
            } else if (item.href) {
                await navigate(item.href)
            }
        },
        [history.remember, navigate, text]
    )

    /** Enter on the text itself: the search page */
    const submit = useCallback(async () => {
        if (!text) {
            return
        }

        history.remember({ kind: 'query', label: text })
        await navigate(`/search?q=${encodeURIComponent(text)}`)
    }, [history.remember, navigate, text])

    return {
        hint,
        items,
        loading,
        query,
        sections,
        select,
        setQuery,
        submit
    }
}

export default useSiteSearch
