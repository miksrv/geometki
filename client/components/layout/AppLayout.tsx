import React, { useEffect, useState } from 'react'
import { cn, Dialog } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'
import NextNProgress from 'nextjs-progressbar'

import { closeAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { AppBar } from './app-bar'
import { BottomNav } from './bottom-nav'
import { Footer } from './footer'
import { Snackbar } from './snackbar'

import styles from './styles.module.sass'

const LoginForm = dynamic(() => import('./login-form').then((m) => ({ default: m.LoginForm })), { ssr: false })

const RegistrationForm = dynamic(() => import('./registration-form').then((m) => ({ default: m.RegistrationForm })), {
    ssr: false
})

type AuthFormType = 'login' | 'registration'

interface AppLayoutProps {
    className?: string
    /** Edge-to-edge layout without container paddings and footer (map page) */
    fullSize?: boolean
    /**
     * Desktop only: the page is exactly one viewport high and has no footer, so its own blocks
     * scroll inside it (search page). Content width and paddings stay as on other pages;
     * phones keep the regular scrolling page with the footer.
     */
    fitViewport?: boolean
    children?: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({ className, fullSize, fitViewport, children }) => {
    const { t } = useTranslation('components.app-layout')
    const dispatch = useAppDispatch()

    const application = useAppSelector((store) => store.application)

    const [authForm, setAuthForm] = useState<AuthFormType>('login')

    const handleCloseAuthDialog = () => {
        setAuthForm('login')
        dispatch(closeAuthDialog())
    }

    useEffect(() => {
        document.body.style.overflow = application.showOverlay ? 'hidden' : ''

        return () => {
            document.body.style.overflow = ''
        }
    }, [application.showOverlay])

    return (
        <div
            className={cn(styles.appLayout, fullSize && styles.fullSize, fitViewport && styles.fitViewport, className)}
        >
            <a
                href={'#main-content'}
                className={styles.skipLink}
            >
                {t('skip-to-content', { defaultValue: 'Перейти к содержимому' })}
            </a>

            <NextNProgress
                color={'var(--color-main)'}
                options={{ showSpinner: false }}
            />

            <div
                aria-hidden={true}
                className={cn(styles.overlay, application.showOverlay ? styles.displayed : styles.hidden)}
            />

            <Dialog
                open={application.showAuthDialog}
                onCloseDialog={handleCloseAuthDialog}
                maxWidth={'400px'}
            >
                {application.showAuthDialog && (
                    <>
                        {authForm === 'login' && <LoginForm onClickRegistration={() => setAuthForm('registration')} />}
                        {authForm === 'registration' && <RegistrationForm onClickLogin={() => setAuthForm('login')} />}
                    </>
                )}
            </Dialog>

            <AppBar fullSize={fullSize} />

            <main
                id={'main-content'}
                className={styles.main}
            >
                {children}
            </main>

            {!fullSize && <Footer className={fitViewport ? styles.desktopHidden : undefined} />}

            <BottomNav />

            <Snackbar />
        </div>
    )
}
