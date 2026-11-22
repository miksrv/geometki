import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { parseQuestId, questHref } from '@/utils/game'
import { loadPageTranslations } from '@/utils/translations.server'

import type { QuestPageProps } from './QuestPage'

interface LoadQuestPageOptions {
    /** The route param: the bare id or `{id}-{slug}` */
    param?: string | string[]
    locale?: string
}

/**
 * The data of a quest page, rendered on every request with the visitor's token: what they see
 * of the quest depends on their walk. Server only; call after `hydrateAuthFromCookies`. The
 * answer stays in the hydrated store: the page's hook subscribes to it. Any other address than
 * `{id}-{slug}` redirects to it for good: the slug follows the title.
 */
export const loadQuestPage = async (
    store: AppStore,
    { param, locale: contextLocale }: LoadQuestPageOptions
): Promise<{ props: QuestPageProps } | { notFound: true } | { redirect: { destination: string; statusCode: 301 } }> => {
    const rawParam = typeof param === 'string' ? param : undefined
    const id = parseQuestId(rawParam)
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    const translations = await loadPageTranslations()

    if (!rawParam || !id) {
        return { notFound: true }
    }

    store.dispatch(setLocale(locale))

    const { data, error } = await store.dispatch(API.endpoints.questsGetItem.initiate({ id }))

    if (error) {
        // No such quest, or a draft for anyone but an administrator
        if ('status' in error && error.status === 404) {
            return { notFound: true }
        }

        throw new Error(`Failed to load quest ${id}: ${JSON.stringify(error)}`)
    }

    const canonical = questHref(id, data?.slug)

    if (`/quests/${rawParam}` !== canonical) {
        return { redirect: { destination: `${locale === 'en' ? '/en' : ''}${canonical}`, statusCode: 301 } }
    }

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    return { props: { ...translations, id, quest: data } }
}
