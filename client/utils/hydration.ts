import { API } from '@/api'
import type { AppStore } from '@/app/store'

/** What `store.dispatch(API.endpoints.x.initiate(...))` returns: the request, not its answer */
interface QueryRequest {
    queryCacheKey: string
    unsubscribe: () => void
}

/**
 * Drops answers a page passes as props from the store it hydrates: the page data would carry
 * them twice. Only for answers no component asks for with a hook (it would ask the API again).
 * Call after the requests have finished.
 */
export const dropFromHydration = (store: AppStore, ...requests: Array<QueryRequest | undefined>): void => {
    for (const request of requests) {
        if (!request) {
            continue
        }

        request.unsubscribe()
        store.dispatch(API.internalActions.removeQueryResult({ queryCacheKey: request.queryCacheKey as never }))
    }
}
