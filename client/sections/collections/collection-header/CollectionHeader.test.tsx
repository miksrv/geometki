import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { CollectionHeader } from './CollectionHeader'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, 'aria-label': ariaLabel }: any) => (
        <button
            aria-label={label ?? ariaLabel}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    Popout: ({ trigger, children }: any) => (
        <div>
            {trigger}
            {children}
        </div>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/link', () => {
    const Link = ({ href, children, onClick, title }: any) => (
        <a
            href={href}
            title={title}
            onClick={onClick}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => {
            const value = (opts?.defaultValue as string) ?? key
            return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => String(opts?.[name] ?? ''))
        }
    })
}))

jest.mock('@/components/shared', () => ({
    PageHeader: ({ title, description, breadcrumbs, actions }: any) => (
        <header>
            <nav>
                {breadcrumbs?.map((link: any) => (
                    <a
                        key={link.link}
                        href={link.link}
                    >
                        {link.text}
                    </a>
                ))}
            </nav>
            <h1>{title}</h1>
            <div>{description}</div>
            <div>{actions}</div>
        </header>
    ),
    UserAvatar: ({ user }: { user?: { id: string; name: string } }) => <a href={`/users/${user?.id}`}>{user?.name}</a>
}))

jest.mock('@/utils/helpers', () => ({
    timeAgo: () => '3 дня назад'
}))

const collection = {
    id: 'c1',
    title: 'Водоёмы Оренбургской области',
    author: { id: 'u1', name: 'Михаил' },
    region: { id: 7, name: 'Оренбургская область' },
    placesCount: 12,
    updated: { date: '2026-10-03 10:00:00' }
} as unknown as ApiModel.Collection

describe('CollectionHeader', () => {
    it('renders breadcrumbs, the title and the byline without a cover', () => {
        render(<CollectionHeader collection={collection} />)

        expect(screen.getByRole('link', { name: 'Коллекции' })).toHaveAttribute('href', '/collections')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Водоёмы Оренбургской области')
        expect(screen.getByRole('link', { name: 'Михаил' })).toHaveAttribute('href', '/users/u1')
        expect(screen.getByText('12 мест')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Оренбургская область' })).toHaveAttribute(
            'href',
            '/collections?region=7'
        )
        expect(screen.getByText('обновлено 3 дня назад')).toBeInTheDocument()
        expect(document.querySelector('img')).not.toBeInTheDocument()
    })

    it('shows no owner controls to readers', () => {
        render(<CollectionHeader collection={collection} />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('lets the owner enter edit mode and open settings or delete', () => {
        const onEdit = jest.fn()
        const onOpenSettings = jest.fn()
        const onDelete = jest.fn()

        render(
            <CollectionHeader
                collection={collection}
                isOwner
                onEdit={onEdit}
                onOpenSettings={onOpenSettings}
                onDelete={onDelete}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }))
        expect(onEdit).toHaveBeenCalled()

        // Actions, not navigation: menu items are buttons
        expect(screen.getByRole('button', { name: 'Настройки коллекции' })).toHaveAttribute('type', 'button')
        expect(screen.getByRole('button', { name: 'Удалить коллекцию' })).toHaveAttribute('type', 'button')

        fireEvent.click(screen.getByText('Настройки коллекции'))
        expect(onOpenSettings).toHaveBeenCalled()

        fireEvent.click(screen.getByText('Удалить коллекцию'))
        expect(onDelete).toHaveBeenCalled()
    })

    it('shows "Готово" and "Отмена" instead of the edit button in edit mode', () => {
        const onDone = jest.fn()
        const onCancel = jest.fn()

        render(
            <CollectionHeader
                collection={collection}
                isOwner
                editMode
                onDone={onDone}
                onCancel={onCancel}
            />
        )

        expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Готово' }))
        expect(onDone).toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
        expect(onCancel).toHaveBeenCalled()
    })
})
