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
 * The place in the game, one line under "Я здесь был(а)" in the "Где это" card. There is one
 * check-in on the site, that button: this line only says whether the visit is confirmed and,
 * within a season (`game` of `GET /visits/me`), what it means there. Without a season: a visit of
 * this week not made on the spot reads "Визит не подтверждён" with "Я сейчас здесь", a
 * confirmed one "Визит подтверждён"; before a visit nothing is shown. In a season:
 * before a visit, what a check-in on the spot gives ("+30 за отметку на месте"). Checked in from
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
    const visit = data ? currentVisitOf(data, localPlainDate(0)) : undefined

    if (!placeId || (!game && !visit)) {
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
            const answer = await postVisit({ ...position, place: placeId, visitedAt: localPlainDate(0) }).unwrap()

            void dispatch(
                answer.game?.confirmed
                    ? NotifyReplace({
                          id: TOAST_ID,
                          message:
                              answer.game.points > 0
                                  ? `${t('game-place-confirmed')}: ${t('game-points-plus', { count: answer.game.points })}`
                                  : t('visit-confirmed'),
                          type: 'success'
                      })
                    : Notify({
                          id: TOAST_ID,
                          message: answer.game?.far
                              ? t('game-place-far', { distance: answer.game.far })
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

    const hereNow = (
        <Button
            mode={'link'}
            size={'small'}
            loading={busy}
            disabled={busy}
            label={t('game-place-here-now')}
            onClick={() => void handleHere()}
        />
    )

    // No season: only whether the visit of this week is confirmed, and the way to confirm it
    if (!game) {
        return (
            <div className={styles.game}>
                <div className={styles.row}>
                    {visit?.confirmed ? (
                        <span className={styles.counted}>{t('visit-confirmed')}</span>
                    ) : (
                        <>
                            <span className={styles.text}>{t('visit-not-confirmed')}</span>
                            {hereNow}
                        </>
                    )}
                </div>
            </div>
        )
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
    if (visit) {
        return (
            <div className={styles.game}>
                <div className={styles.row}>
                    <span className={styles.text}>{t('game-place-not-counted')}</span>
                    {hereNow}
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
