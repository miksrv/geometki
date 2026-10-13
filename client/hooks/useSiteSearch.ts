import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/router'

import { API, ApiType } from '@/api'
import { AutocompleteOption } from '@/components/ui'
import { categoryImage } from '@/utils/categories'
import { buildPlaceUrl } from '@/utils/helpers'

enum SuggestionType {
    PLACE = 'place',
    LOCATION = 'location',
    COORDINATES = 'coordinates'
}

/**
 * The site search behind every search field (the app bar, the home page hero): the
 * suggestions for the typed text, a place suggestion opens the place, a location or
 * coordinates open the map there, Enter opens `/search`. Returns the props of an
 * `Autocomplete` plus `reset()`, which puts the URL query back into the field.
 */
const useSiteSearch = () => {
    const router = useRouter()

    const urlQuery = (router.query.q as string) ?? ''
    const [inputValue, setInputValue] = useState<string>(urlQuery)

    useEffect(() => {
        setInputValue(urlQuery)
    }, [urlQuery])

    const isOnSearchPage = router.pathname === '/search'
    const inputMatchesUrl = inputValue.trim() === urlQuery.trim()
    const skipSuggestions = isOnSearchPage && inputMatchesUrl

    const { data: suggestData, isFetching } = API.useSearchSuggestQuery(inputValue, {
        skip: inputValue.length < 2 || skipSuggestions
    })

    const options = useMemo<Array<AutocompleteOption<ApiType.Search.Suggestion>>>(
        () =>
            suggestData?.suggestions?.map((suggestion) => {
                if (suggestion.type === SuggestionType.PLACE) {
                    return {
                        title: suggestion.title,
                        type: SuggestionType.PLACE,
                        image: suggestion.category ? categoryImage(suggestion.category) : undefined,
                        value: suggestion
                    }
                }

                if (suggestion.type === SuggestionType.LOCATION) {
                    return {
                        title: suggestion.title,
                        type: SuggestionType.LOCATION,
                        value: suggestion
                    }
                }

                return {
                    title: `${suggestion.lat}, ${suggestion.lon}`,
                    type: SuggestionType.COORDINATES,
                    value: suggestion
                }
            }) ?? [],
        [suggestData?.suggestions]
    )

    const onEnterPress = async (q: string) => {
        const trimmed = q.trim()

        if (trimmed) {
            await router.push(`/search?q=${encodeURIComponent(trimmed)}`)
        }
    }

    const onSelect = async (option?: AutocompleteOption<ApiType.Search.Suggestion>) => {
        if (!option) {
            return
        }

        const suggestion = option.value

        if (suggestion.type === SuggestionType.PLACE) {
            await router.push(buildPlaceUrl(suggestion.id, suggestion.slug))
            return
        }

        const zoom = suggestion.type === SuggestionType.COORDINATES ? 14 : 12
        const hash = `${suggestion.lat},${suggestion.lon},${zoom}?m=${suggestion.lat},${suggestion.lon}`

        if (router.pathname === '/map') {
            await router.replace({ hash, pathname: '/map' })
        } else {
            await router.push(`/map#${hash}`)
        }
    }

    return {
        hideArrow: !options.length || !inputValue.length,
        inputValue,
        loading: isFetching,
        onEnterPress: (value: string) => void onEnterPress(value),
        onSearch: setInputValue,
        onSelect: (option?: AutocompleteOption<ApiType.Search.Suggestion>) => void onSelect(option),
        options,
        reset: () => setInputValue(urlQuery),
        suppressDropdown: skipSuggestions
    }
}

export default useSiteSearch
