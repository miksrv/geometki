import React from 'react'
import { cn, Icon, Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

interface ReputationProps {
    value: number
    /** 20px high (`small`, the default: cards and lines) or 24px — the two sizes of `GamePoints` */
    size?: 'small' | 'medium'
}

/** "+12", "−3", "0": the sign is a part of the number — a reputation goes both ways */
export const formatReputation = (value: number): string =>
    value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'

/**
 * The person's share of the scores of the places they added or improved, a pill of the same
 * make as the geopoints (DESIGN.md → Marks: what is counted is a pill with a mark and a number;
 * a hexagon is what a person has become or earned): a star — the reputation comes from the
 * scores of places — and the number with its sign, on a green tint above zero, a red one
 * below, a grey one at zero. The number says nothing by itself: the tooltip tells how it is
 * made (on hover and on keyboard focus)
 */
export const Reputation: React.FC<ReputationProps> = ({ value, size = 'small' }) => {
    const { t } = useTranslation()

    return (
        <Tooltip
            content={t('reputation-hint', {
                defaultValue:
                    'Из оценок мест: 5★ +2, 4★ +1, 2★ −1, 1★ −2. Половина — автору места, половина — тем, кто дополнил карточку фото и правками'
            })}
        >
            <div
                className={cn(
                    styles.reputation,
                    size === 'small' && styles.small,
                    value > 0 ? styles.green : value < 0 ? styles.red : undefined
                )}
                tabIndex={0}
                aria-label={`${t('reputation', { defaultValue: 'Репутация' })}: ${value}`}
            >
                <Icon
                    name={'StarFilled'}
                    className={styles.icon}
                />
                {formatReputation(value)}
            </div>
        </Tooltip>
    )
}
