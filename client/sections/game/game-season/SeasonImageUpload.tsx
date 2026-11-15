import React, { useRef } from 'react'
import { cn } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

const ACCEPT = 'image/png,image/svg+xml'
const MAX_SIZE = 1024 * 1024

interface SeasonImageUploadProps {
    seasonId: string
    /** The season's picture: the button itself */
    children: React.ReactNode
}

/**
 * The administrator's control of a season's picture: the picture itself is the button, on the
 * season's page, at any time. The one thing of a season made by hand. PNG or SVG up to 1 MB,
 * as an achievement's picture; the page is loaded anew with the picture in place.
 */
export const SeasonImageUpload: React.FC<SeasonImageUploadProps> = ({ seasonId, children }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)

    const [upload, { isLoading }] = API.useGamePostSeasonImageMutation()

    const notify = (message: string, type: 'success' | 'error') =>
        void dispatch(Notify({ id: 'seasonImage', message, title: '', type }))

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        // Lets the same file be picked again
        event.target.value = ''

        if (!file) {
            return
        }

        if (!ACCEPT.split(',').includes(file.type) || file.size > MAX_SIZE) {
            notify(t('game-season-image-rejected'), 'error')
            return
        }

        try {
            await upload({ file, id: seasonId }).unwrap()
            notify(t('game-season-image-saved'), 'success')
            await router.replace(router.asPath, undefined, { scroll: false })
        } catch (error) {
            notify(getErrorMessage(error) ?? t('game-season-image-rejected'), 'error')
        }
    }

    return (
        <>
            <input
                ref={inputRef}
                type={'file'}
                accept={ACCEPT}
                hidden={true}
                onChange={(event) => void handleChange(event)}
            />
            <button
                type={'button'}
                className={cn(styles.badgeButton, isLoading && styles.badgeLoading)}
                disabled={isLoading}
                aria-label={t('game-season-image')}
                title={t('game-season-image')}
                onClick={() => inputRef.current?.click()}
            >
                {children}
            </button>
        </>
    )
}
