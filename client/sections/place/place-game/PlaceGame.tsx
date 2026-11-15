import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify, NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { currentVisitOf, GamePoints } from '@/components/shared'
import usePreciseLocation from '@/hooks/usePreciseLocation'
import { getErrorMessage } from '@/utils/api'
import { localPlainDate } from '@/utils/date'

import styles from './styles.module.sass'

const TOAST_ID = 'place-game'

interface PlaceGameProps {
    placeId?: string
}

/**
 * The place in the season, one line under "Я здесь был(а)" in the "Где это" card — within a
 * season (`game` of `GET /visits/me`; nothing otherwise). There
 * is one check-in on the site, that button: this line only says what it means for the season.
 * Before a visit: what a check-in on the spot gives ("+30 за отметку на месте"). Checked in from
 * elsewhere (or without a position): "В сезон не засчитано" and the one extra action, "Я сейчас
 * здесь" — it asks the browser for the position and sends the same check-in again. Counted (by
 * a check-in on the spot or a photo shot here): the geopoints got, and for a check-in the bonus
 * a photo would add.
 */
export const PlaceGame: React.FC<PlaceGameProps> = ({ placeId }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data } = API.useVisitsGetMeQuery({ place: placeId! }, { skip: !placeId || !isAuth })
    const { loading: locating, request: requestPosition } = usePreciseLocation()
    // The same request as the button's: one loading state for the place
    const [postVisit, { isLoading }] = API.useVisitsPostMutation({ fixedCacheKey: `visit-${placeId}` })

    const game = data?.game

    if (!placeId || !game) {
        return null
    }

    const busy = locating || isLoading

    // Asked for by name: unlike the button's own request, a refusal and a far place are told
    const handleHere = async () => {
        const position = await requestPosition()

        if (!position) {
            return
        }

        try {
            const visit = await postVisit({ ...position, place: placeId, visitedAt: localPlainDate(0) }).unwrap()

            void dispatch(
                visit.game?.confirmed
                    ? NotifyReplace({
                          id: TOAST_ID,
                          message: [
                              t('game-place-confirmed'),
                              visit.game.points > 0 && t('game-points-plus', { count: visit.game.points })
                          ]
                              .filter(Boolean)
                              .join(': '),
                          type: 'success'
                      })
                    : Notify({
                          id: TOAST_ID,
                          message: visit.game?.far
                              ? t('game-place-far', { distance: visit.game.far })
                              : t('game-here-error'),
                          title: '',
                          type: 'error'
                      })
            )
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
    }

    if (game.earned != null) {
        return (
            <div className={styles.game}>
                <div className={styles.row}>
                    <GamePoints
                        value={game.earned}
                        plus={true}
                        label={t('game-points', { count: game.earned })}
                    />
                    <span className={styles.counted}>{t('game-place-confirmed')}</span>
                </div>
                {game.way === 'geo' && (
                    <p className={styles.note}>{t('game-place-photo-more', { count: game.photoBonus })}</p>
                )}
            </div>
        )
    }

    // Checked in this week, but not on the spot: the one way to count it without a photo
    if (currentVisitOf(data, localPlainDate(0))) {
        return (
            <div className={styles.game}>
                <div className={styles.row}>
                    <span className={styles.text}>{t('game-place-not-counted')}</span>
                    <Button
                        mode={'link'}
                        size={'small'}
                        loading={busy}
                        disabled={busy}
                        label={t('game-place-here-now')}
                        onClick={() => void handleHere()}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.game}>
            <div className={styles.row}>
                <GamePoints
                    value={game.points}
                    plus={true}
                    label={t('game-points-for-visit', { count: game.points })}
                />
                <span className={styles.text}>{t('game-place-offer')}</span>
            </div>
        </div>
    )
}
