import { useCallback } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { Notify, NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import usePreciseLocation from '@/hooks/usePreciseLocation'
import useRequireAuth from '@/hooks/useRequireAuth'
import { getErrorMessage, isApiRefusal } from '@/utils/api'
import { localPlainDate } from '@/utils/date'
import { isSecretMode } from '@/utils/game'

const TOAST_ID = 'quest-confirm'

/**
 * A quest's actions. `start` begins the walk (a guest signs in first); `leave` gives it up. `confirm` is
 * "Я на месте" on a quest begun: then the browser is asked for the position
 * once, the server compares it with the point and drops it. A toast tells what came of it:
 * the point confirmed (with the season points of its place), the quest finished (with its
 * bonus), or how far the point still is (the server's words, a plain notice, not an error:
 * a riddle's answer says only that it is not the place — its distance would be a hint). One request at a time for the whole page (the side
 * panel, the steps and the phone bar share it).
 */
export const useQuestConfirm = (quest?: Pick<ApiType.Game.Quest, 'id' | 'mode'>) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const requireAuth = useRequireAuth()
    const { loading: locating, request: requestPosition } = usePreciseLocation()

    const [postConfirm, { isLoading: confirming }] = API.useQuestsPostConfirmMutation({
        fixedCacheKey: `quest-confirm-${quest?.id}`
    })

    const [postStart, { isLoading: starting }] = API.useQuestsPostStartMutation({
        fixedCacheKey: `quest-start-${quest?.id}`
    })

    const [deleteWalk, { isLoading: leaving }] = API.useQuestsDeleteWalkMutation({
        fixedCacheKey: `quest-leave-${quest?.id}`
    })

    // Giving up a walk: the quest is as before it was begun, the visits made on it stay
    const leave = useCallback(async () => {
        if (!quest) {
            return
        }

        try {
            await deleteWalk(quest.id).unwrap()

            void dispatch(NotifyReplace({ id: TOAST_ID, message: t('game-quest-left'), type: 'success' }))
        } catch (error) {
            void dispatch(
                Notify({
                    id: TOAST_ID,
                    message: getErrorMessage(error) ?? t('game-quest-form-error'),
                    title: '',
                    type: 'error'
                })
            )
        }
    }, [deleteWalk, dispatch, quest, t])

    // A walk is begun by the walker, on the quest's page: nothing begins it by itself
    const start = useCallback(async () => {
        if (!quest || !requireAuth()) {
            return
        }

        try {
            await postStart(quest.id).unwrap()

            void dispatch(NotifyReplace({ id: TOAST_ID, message: t('game-quest-started'), type: 'success' }))
        } catch (error) {
            void dispatch(
                Notify({
                    id: TOAST_ID,
                    message: getErrorMessage(error) ?? t('game-here-error'),
                    title: '',
                    type: 'error'
                })
            )
        }
    }, [dispatch, postStart, requireAuth, quest, t])

    const confirm = useCallback(
        async (pointId?: string) => {
            if (!quest || !requireAuth()) {
                return
            }

            const position = await requestPosition()

            if (!position) {
                return
            }

            try {
                const result = await postConfirm({
                    ...position,
                    id: quest.id,
                    point: pointId,
                    visitedAt: localPlainDate(0)
                }).unwrap()

                const message = result.finished
                    ? [
                          t('game-quest-finished-toast'),
                          result.bonus > 0 && t('game-quest-finished-experience', { count: result.bonus })
                      ]
                    : [
                          t(isSecretMode(quest.mode) ? 'game-quest-riddle-solved' : 'game-quest-point-confirmed'),
                          result.points > 0 && t('game-points-plus', { count: result.points })
                      ]

                void dispatch(
                    NotifyReplace({ id: TOAST_ID, message: message.filter(Boolean).join(' '), type: 'success' })
                )
            } catch (error) {
                // Too far, or a walk not begun: the server's words in a plain notice; red only
                // for a failure (the server's, the network's)
                void dispatch(
                    NotifyReplace({
                        id: TOAST_ID,
                        message: getErrorMessage(error) ?? t('game-here-error'),
                        type: isApiRefusal(error) ? 'info' : 'error'
                    })
                )
            }
        },
        [dispatch, postConfirm, requestPosition, requireAuth, quest, t]
    )

    return { busy: locating || confirming || starting || leaving, confirm, leave, start }
}
