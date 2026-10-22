import React from 'react'
import { cn, Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

interface ReputationProps {
    value: number
}

/**
 * The person's share of the scores of the places they added or improved. The bare number says nothing by itself:
 * the tooltip tells how it is made (on hover and on keyboard focus)
 */
export const Reputation: React.FC<ReputationProps> = ({ value }) => {
    const { t } = useTranslation()

    return (
        <Tooltip
            content={t('reputation-hint', {
                defaultValue:
                    'Из оценок мест: 5★ +2, 4★ +1, 2★ −1, 1★ −2. Половина — автору места, половина — тем, кто дополнил карточку фото и правками'
            })}
        >
            <div
                className={cn(styles.reputation, value > 0 ? styles.green : value < 0 ? styles.red : undefined)}
                tabIndex={0}
                aria-label={`${t('reputation', { defaultValue: 'Репутация' })}: ${value}`}
            >
                {value}
            </div>
        </Tooltip>
    )
}
