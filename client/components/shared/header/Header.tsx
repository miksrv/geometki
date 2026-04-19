import React from 'react'
import { Button, cn, Container } from 'simple-react-ui-kit'

import { ApiModel } from '@/api'
import { Breadcrumbs, BreadcrumbsProps } from '@/components/ui'

import { UserAvatar } from '../user-avatar'

import styles from './styles.module.sass'

interface HeaderProps extends BreadcrumbsProps {
    title?: string
    backLink?: string
    className?: string
    attachedBottom?: boolean
    userData?: ApiModel.User
    actions?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({
    title,
    backLink,
    className,
    attachedBottom,
    userData,
    actions,
    ...props
}) => (
    <Container className={cn(styles.header, attachedBottom && styles.attachedBottom, className)}>
        {backLink && (
            <Button
                mode={'outline'}
                icon={'KeyboardLeft'}
                link={backLink}
                className={styles.backLink}
            />
        )}

        {userData?.id && (
            <UserAvatar
                className={styles.userAvatar}
                user={userData}
                size={'medium'}
            />
        )}

        <header>
            <h1>{title}</h1>
            <Breadcrumbs {...props} />
        </header>

        {actions && <div className={styles.actions}>{actions}</div>}
    </Container>
)
