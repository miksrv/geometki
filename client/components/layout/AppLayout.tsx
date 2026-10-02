import React, { useEffect, useState } from 'react'
import { cn, Dialog } from 'simple-react-ui-kit'

import NextNProgress from 'nextjs-progressbar'

import { closeAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { AppBar } from './app-bar'
import { BottomNav } from './bottom-nav'
import { Footer } from './footer'
import { LoginForm } from './login-form'
import { RegistrationForm } from './registration-form'
import { Snackbar } from './snackbar'

import styles from './styles.module.sass'

type AuthFormType = 'login' | 'registration'

interface AppLayoutProps {
    className?: string
    /** Edge-to-edge layout without container paddings and footer (map page) */
    fullSize?: boolean
    children?: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({ className, fullSize, children }) => {
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
        <div className={cn(styles.appLayout, fullSize && styles.fullSize, className)}>
            <NextNProgress
                color={'#2688eb'}
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
                {authForm === 'login' && <LoginForm onClickRegistration={() => setAuthForm('registration')} />}
                {authForm === 'registration' && <RegistrationForm onClickLogin={() => setAuthForm('login')} />}
            </Dialog>

            <AppBar fullSize={fullSize} />

            <main className={styles.main}>{children}</main>

            {!fullSize && <Footer />}

            <BottomNav />

            <Snackbar />
        </div>
    )
}
