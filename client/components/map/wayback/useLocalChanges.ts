import { useEffect, useState } from 'react'

import { APIWayback, collectLocalChanges, WaybackRelease } from '@/api/apiWayback'
import { useAppDispatch } from '@/app/store'

export type WaybackTile = { x: number; y: number; z: number }

type LocalChangesState = {
    // The tile the list is for: the list of the previous tile stays until the new one has its first change
    tile?: WaybackTile
    changes: WaybackRelease[]
    complete: boolean
    error: boolean
}

/**
 * The releases in which the imagery of the tile changed, newest first. The list grows while the archive
 * is walked (the newest imagery is there after the first request); moving to another tile stops the walk
 */
export const useLocalChanges = (tile?: WaybackTile) => {
    const dispatch = useAppDispatch()
    const { data: releases, isError: releasesError } = APIWayback.useGetReleasesQuery()

    const [state, setState] = useState<LocalChangesState>({ changes: [], complete: false, error: false })

    useEffect(() => {
        if (!tile || !releases) {
            return
        }

        let cancelled = false

        const getTilemap = async (release: number) => {
            const request = dispatch(APIWayback.endpoints.getTilemap.initiate({ release, ...tile }))

            try {
                return await request.unwrap()
            } finally {
                request.unsubscribe()
            }
        }

        setState((prev) => ({ ...prev, complete: false, error: false }))

        collectLocalChanges(
            releases,
            getTilemap,
            (changes) => setState({ changes, complete: false, error: false, tile }),
            () => cancelled
        )
            .then((changes) => {
                if (!cancelled) {
                    setState({ changes, complete: true, error: false, tile })
                }
            })
            .catch(() => {
                if (!cancelled) {
                    // What was found before the failure is still shown
                    setState((prev) =>
                        prev.tile === tile
                            ? { ...prev, complete: true, error: !prev.changes.length }
                            : { changes: [], complete: true, error: true, tile }
                    )
                }
            })

        return () => {
            cancelled = true
        }
    }, [tile, releases, dispatch])

    return {
        changes: state.changes,
        isError: releasesError || state.error,
        isFetching: !releasesError && !state.complete && !state.error
    }
}
