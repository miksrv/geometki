import { useEffect, useRef } from 'react'

import { INFINITE_SCROLL_ROOT_MARGIN } from '@/config/constants'

interface UseInfiniteScrollOptions {
    /** There is a next page to load */
    hasMore?: boolean
    /** A page is loading: no new request until it is done */
    loading?: boolean
    /**
     * The last page failed: no new request, or the sentinel — still in view — would
     * repeat it at once, forever. The list offers a retry instead.
     */
    failed?: boolean
    onLoadMore: () => void
}

/**
 * Loads the next page when the returned sentinel element comes near the viewport
 * (INFINITE_SCROLL_ROOT_MARGIN ahead). Put the sentinel right after the list.
 */
export const useInfiniteScroll = <T extends HTMLElement = HTMLDivElement>({
    hasMore,
    loading,
    failed,
    onLoadMore
}: UseInfiniteScrollOptions) => {
    const sentinelRef = useRef<T>(null)
    const onLoadMoreRef = useRef(onLoadMore)

    onLoadMoreRef.current = onLoadMore

    useEffect(() => {
        const sentinel = sentinelRef.current

        if (!sentinel || !hasMore || loading || failed) {
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    onLoadMoreRef.current()
                }
            },
            { rootMargin: INFINITE_SCROLL_ROOT_MARGIN }
        )

        observer.observe(sentinel)

        return () => observer.disconnect()
    }, [hasMore, loading, failed])

    return sentinelRef
}
