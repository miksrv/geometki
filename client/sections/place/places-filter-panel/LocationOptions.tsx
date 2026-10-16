import React, { useEffect, useMemo, useState } from 'react'
import { Icon, Input } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { OptionList, OptionListGroup } from '@/components/ui'

import styles from './styles.module.sass'

/** Russia: "Популярные регионы" are the fullest regions of the site's home country */
const HOME_COUNTRY_ID = 1
const POPULAR_REGIONS_LIMIT = 5
const SEARCH_MIN_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 400

export const NEAR_KEY = 'near'
export const ANYWHERE_KEY = 'anywhere'

export type LocationChoice = typeof NEAR_KEY | typeof ANYWHERE_KEY | ApiModel.AddressItem

interface LocationOptionsProps {
    location?: ApiModel.AddressItem
    /** "Рядом со мной" is the current choice: no location, sorted by distance */
    near?: boolean
    recentLocations: ApiModel.AddressItem[]
    /** Focus the search field on mount (the field's dropdown, the sheet) */
    autoFocus?: boolean
    onPick: (choice: LocationChoice) => void
}

const keyOf = (item: ApiModel.AddressItem) => `${item.type}:${item.id}`

/**
 * The answers to "Где?": a search field, then — before anything is typed — "Рядом со мной",
 * "Везде", the visitor's recent locations and the fullest regions; while typing, the found
 * regions, districts and cities. The same list in the desktop dropdown and the phone sheet.
 */
export const LocationOptions: React.FC<LocationOptionsProps> = ({
    location,
    near,
    recentLocations,
    autoFocus,
    onPick
}) => {
    const { t } = useTranslation()

    const [query, setQuery] = useState<string>('')
    const [searchAddress, { data: found, isLoading: searching }] = API.useLocationGetSearchMutation()
    const { data: regions } = API.useLocationsGetChildrenQuery({ id: HOME_COUNTRY_ID, type: 'country' })

    const text = query.trim()
    const isSearching = text.length >= SEARCH_MIN_LENGTH

    useEffect(() => {
        if (!isSearching) {
            return
        }

        const timer = setTimeout(() => void searchAddress(text), SEARCH_DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [text])

    const items = useMemo(() => {
        const all = new Map<string, ApiModel.AddressItem>()
        recentLocations.forEach((item) => all.set(keyOf(item), item))
        regions?.items?.forEach((item) => all.set(`${item.type}:${item.id}`, { ...item, name: item.title }))
        ;(
            [
                ['country', found?.countries],
                ['region', found?.regions],
                ['district', found?.districts],
                ['locality', found?.cities]
            ] as Array<[ApiType.LocationTypes, ApiModel.AddressItem[] | undefined]>
        ).forEach(([type, list]) => list?.forEach((item) => all.set(`${type}:${item.id}`, { ...item, type })))

        return all
    }, [found, recentLocations, regions])

    const isSelected = (item: ApiModel.AddressItem) => !!location && keyOf(location) === keyOf(item)

    const pin = <Icon name={'Point'} />

    const groups: OptionListGroup[] = isSearching
        ? (
              [
                  ['country', found?.countries, t('location-group-countries', 'Страны')],
                  ['region', found?.regions, t('location-group-regions', 'Регионы')],
                  ['district', found?.districts, t('location-group-districts', 'Районы')],
                  ['locality', found?.cities, t('location-group-cities', 'Города и сёла')]
              ] as Array<[ApiType.LocationTypes, ApiModel.AddressItem[] | undefined, string]>
          ).map(([type, list, label]) => ({
              items: (list ?? []).slice(0, 6).map((item) => ({
                  icon: pin,
                  key: `${type}:${item.id}`,
                  label: item.name,
                  selected: isSelected({ ...item, type })
              })),
              label
          }))
        : [
              {
                  items: [
                      {
                          accent: true,
                          caption: t('location-near-caption', 'Сначала ближайшие'),
                          icon: <Icon name={'Position'} />,
                          key: NEAR_KEY,
                          label: t('location-near', 'Рядом со мной'),
                          selected: near
                      },
                      {
                          caption: t('location-anywhere-caption', 'Без ограничений'),
                          icon: <Icon name={'Compass'} />,
                          key: ANYWHERE_KEY,
                          label: t('location-anywhere', 'Везде'),
                          selected: !location && !near
                      }
                  ]
              },
              {
                  items: recentLocations.map((item) => ({
                      icon: <Icon name={'Time'} />,
                      key: keyOf(item),
                      label: item.name,
                      selected: isSelected(item)
                  })),
                  label: t('location-group-recent', 'Недавние')
              },
              {
                  items: [...(regions?.items ?? [])]
                      .sort((a, b) => b.placesCount - a.placesCount)
                      .slice(0, POPULAR_REGIONS_LIMIT)
                      .map((item) => ({
                          caption: t('places-count', '{{count}} мест', { count: item.placesCount }),
                          icon: pin,
                          key: `${item.type}:${item.id}`,
                          label: item.title,
                          selected: isSelected({ id: item.id, name: item.title, type: item.type })
                      })),
                  label: t('location-group-popular', 'Популярные регионы')
              }
          ]

    const handleSelect = (key: string) => {
        if (key === NEAR_KEY || key === ANYWHERE_KEY) {
            onPick(key)
            return
        }

        const item = items.get(key)

        if (item) {
            onPick({ id: item.id, name: item.name, slug: item.slug ?? null, type: item.type })
        }
    }

    return (
        <div className={styles.locationOptions}>
            <Input
                size={'medium'}
                icon={'Search'}
                clearable={true}
                autoFocus={autoFocus}
                placeholder={t('location-search-placeholder', 'Регион, город или район')}
                value={query}
                aria-label={t('location-search-placeholder', 'Регион, город или район')}
                onChange={(event) => setQuery(event.target.value)}
            />

            <OptionList
                groups={groups}
                emptyText={
                    isSearching && !searching
                        ? t('nothing-found')
                        : text && !isSearching
                          ? t('location-search-hint', 'Введите хотя бы три буквы')
                          : undefined
                }
                onSelect={handleSelect}
            />
        </div>
    )
}
