import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { Notification } from './Notification'

jest.mock('next/router', () => ({
    useRouter: () => ({
        pathname: '/',
        asPath: '/',
        query: {},
        locale: 'ru'
    })
}))

jest.mock('next/link', () => {
    const Link = ({ href, children }: any) => <a href={href}>{children}</a>
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) => opts?.defaultValue ?? key
    })
}))

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Tooltip: ({ children }: any) => children
}))

// Prevent dayjs.utc issues in test environment
jest.mock('@/utils/helpers', () => ({
    ...jest.requireActual('@/utils/helpers'),
    formatDate: () => '15 January 2024, 10:00'
}))

jest.mock('@/components/shared/level-progress/LevelProgress', () => ({
    LevelProgress: ({ levelData }: any) => (
        <div
            data-testid={'level-progress'}
            data-level={levelData?.level}
        />
    )
}))

// Mock NotificationIcon
jest.mock('./NotificationIcon', () => ({
    NotificationIcon: ({ type }: any) => (
        <div
            data-testid={'notification-icon'}
            data-type={type}
        />
    )
}))

const baseNotification = {
    id: 'notif-1',
    type: 'success' as const,
    message: 'Operation completed',
    read: false
}

describe('Notification', () => {
    describe('rendering', () => {
        it('renders the notification message', () => {
            render(<Notification {...baseNotification} />)
            expect(screen.getByText('Operation completed')).toBeInTheDocument()
        })

        it('does not render NotificationIcon for success type', () => {
            render(<Notification {...baseNotification} />)
            expect(screen.queryByTestId('notification-icon')).not.toBeInTheDocument()
        })

        it('does not render NotificationIcon for experience type', () => {
            render(
                <Notification
                    {...baseNotification}
                    type={'experience' as const}
                />
            )
            expect(screen.queryByTestId('notification-icon')).not.toBeInTheDocument()
        })

        it('renders NotificationIcon for achievements type', () => {
            render(
                <Notification
                    {...baseNotification}
                    type={'achievements' as const}
                />
            )
            expect(screen.getByTestId('notification-icon')).toBeInTheDocument()
        })

        it('renders with a custom title', () => {
            render(
                <Notification
                    {...baseNotification}
                    title={'Custom Title'}
                />
            )
            expect(screen.getByText('Custom Title')).toBeInTheDocument()
        })

        it('renders a close button when onClose is provided', () => {
            render(
                <Notification
                    {...baseNotification}
                    onClose={jest.fn()}
                />
            )
            expect(screen.getByTestId('icon-Close')).toBeInTheDocument()
        })

        it('does not render a close button when onClose is omitted', () => {
            render(<Notification {...baseNotification} />)
            expect(screen.queryByTestId('icon-Close')).not.toBeInTheDocument()
        })

        it('applies unread class when read is false', () => {
            const { container } = render(
                <Notification
                    {...baseNotification}
                    read={false}
                />
            )
            expect(container.firstChild).toHaveClass('unread')
        })

        it('does not apply unread class when read is true', () => {
            const { container } = render(
                <Notification
                    {...baseNotification}
                    read={true}
                />
            )
            expect(container.firstChild).not.toHaveClass('unread')
        })
    })

    describe('place link', () => {
        it('renders a link to the place when type is neither experience/level/achievements', () => {
            const notification = {
                ...baseNotification,
                type: 'photo' as const,
                place: { id: 'p1', title: 'Cool Spot', cover: undefined }
            }
            render(<Notification {...notification} />)
            expect(screen.getByRole('link', { name: 'Cool Spot' })).toHaveAttribute('href', '/places/p1')
        })
    })

    describe('collection link', () => {
        it('renders a link to the collection, taking priority over a place link', () => {
            const notification = {
                ...baseNotification,
                type: 'collection_place' as const,
                place: { id: 'p1', title: 'Cool Spot', cover: undefined },
                collection: { id: 'c1', slug: 'waterfalls', title: 'Waterfalls' }
            }
            render(<Notification {...notification} />)
            expect(screen.getByRole('link', { name: 'Waterfalls' })).toHaveAttribute(
                'href',
                '/collections/c1-waterfalls'
            )
            expect(screen.queryByRole('link', { name: 'Cool Spot' })).not.toBeInTheDocument()
        })
    })

    describe('collection and collection_place types', () => {
        it('renders the collection notification title', () => {
            const notification = {
                ...baseNotification,
                type: 'collection' as const
            }
            render(<Notification {...notification} />)
            expect(screen.getByText('Создана новая коллекция')).toBeInTheDocument()
        })

        it('renders the collection_place notification title', () => {
            const notification = {
                ...baseNotification,
                type: 'collection_place' as const,
                collection: { id: 'c1', slug: 'waterfalls', title: 'Waterfalls' }
            }
            render(<Notification {...notification} />)
            expect(screen.getByText('Ваше место добавлено в коллекцию')).toBeInTheDocument()
        })
    })

    describe('bookmark and visit types', () => {
        it('renders the bookmark notification title', () => {
            const notification = {
                ...baseNotification,
                type: 'bookmark' as const,
                place: { id: 'p1', title: 'Cool Spot', cover: undefined }
            }
            render(<Notification {...notification} />)
            expect(screen.getByText('Геометка добавлена в закладки')).toBeInTheDocument()
        })

        it('renders the visit notification title', () => {
            const notification = {
                ...baseNotification,
                type: 'visit' as const,
                place: { id: 'p1', title: 'Cool Spot', cover: undefined }
            }
            render(<Notification {...notification} />)
            expect(screen.getByText('Отмечено посещение геометки')).toBeInTheDocument()
        })
    })

    describe('experience type', () => {
        it('renders xp amount in the title for experience notification type', () => {
            const notification = {
                id: 'exp-1',
                type: 'experience' as const,
                activity: 'rating' as const,
                meta: { value: 50, level: 3 }
            }
            render(<Notification {...notification} />)
            expect(screen.getByText(/Поставлена новая оценка.*\+50 XP/)).toBeInTheDocument()
        })

        it('renders LevelProgress when meta has experience and nextLevel', () => {
            const notification = {
                id: 'exp-2',
                type: 'experience' as const,
                activity: 'place' as const,
                meta: { value: 5, level: 2, experience: 80, levelExperience: 75, nextLevel: 150 }
            }
            render(<Notification {...notification} />)
            expect(screen.getByTestId('level-progress')).toBeInTheDocument()
        })

        it('renders no LevelProgress without the start of the level', () => {
            const notification = {
                id: 'exp-3',
                type: 'experience' as const,
                activity: 'place' as const,
                meta: { value: 5, level: 2, experience: 80, nextLevel: 150 }
            }
            render(<Notification {...notification} />)
            expect(screen.queryByTestId('level-progress')).not.toBeInTheDocument()
        })
    })

    describe('list variant', () => {
        it('renders the formatted date', () => {
            const notification = {
                ...baseNotification,
                created: { date: '2024-01-15T10:00:00Z', timezone_type: 1, timezone: 'UTC' }
            }
            render(
                <Notification
                    {...notification}
                    variant={'list'}
                />
            )
            // The mock formatDate returns '15 January 2024, 10:00'
            expect(screen.getByText('15 January 2024, 10:00')).toBeInTheDocument()
        })

        it('does not render the date in a toast', () => {
            const notification = {
                ...baseNotification,
                created: { date: '2024-01-15T10:00:00Z', timezone_type: 1, timezone: 'UTC' }
            }
            render(<Notification {...notification} />)
            expect(screen.queryByText('15 January 2024, 10:00')).not.toBeInTheDocument()
        })

        it('shows the level badge icon in the list, unlike a toast', () => {
            render(
                <Notification
                    id={'lvl'}
                    type={'level'}
                    meta={{ level: 4, title: 'Explorer' }}
                    variant={'list'}
                />
            )
            expect(screen.getByTestId('notification-icon')).toBeInTheDocument()
            expect(screen.getByText('Explorer (4)')).toBeInTheDocument()
        })

        it('does not link a notification about the user to the place of the activity', () => {
            render(
                <Notification
                    id={'ach'}
                    type={'achievements'}
                    meta={{ title: 'First photo' }}
                    place={{ id: 'p1', title: 'Cool Spot' }}
                    variant={'list'}
                />
            )
            expect(screen.getByText('First photo')).toBeInTheDocument()
            expect(screen.queryByRole('link')).not.toBeInTheDocument()
        })
    })

    describe('toast accessibility', () => {
        it('announces an error toast as an alert', () => {
            render(
                <Notification
                    {...baseNotification}
                    type={'error'}
                />
            )
            expect(screen.getByRole('alert')).toBeInTheDocument()
        })

        it('leaves other toasts to the polite live region of the snackbar', () => {
            render(<Notification {...baseNotification} />)
            expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        })
    })

    describe('auto-dismiss', () => {
        beforeEach(() => {
            jest.useFakeTimers()
        })

        afterEach(() => {
            jest.useRealTimers()
        })

        it('closes the toast when its time is up', () => {
            const onClose = jest.fn()
            render(
                <Notification
                    {...baseNotification}
                    autoDismissMs={1000}
                    onClose={onClose}
                />
            )

            act(() => jest.advanceTimersByTime(999))
            expect(onClose).not.toHaveBeenCalled()

            act(() => jest.advanceTimersByTime(1))
            expect(onClose).toHaveBeenCalledWith('notif-1')
        })

        it('holds the countdown while the toast is hovered and resumes it with the time left', () => {
            const onClose = jest.fn()
            const { container } = render(
                <Notification
                    {...baseNotification}
                    autoDismissMs={1000}
                    onClose={onClose}
                />
            )

            act(() => jest.advanceTimersByTime(600))
            fireEvent.mouseEnter(container.firstChild as Element)
            act(() => jest.advanceTimersByTime(5000))
            expect(onClose).not.toHaveBeenCalled()

            fireEvent.mouseLeave(container.firstChild as Element)
            act(() => jest.advanceTimersByTime(399))
            expect(onClose).not.toHaveBeenCalled()

            act(() => jest.advanceTimersByTime(1))
            expect(onClose).toHaveBeenCalledTimes(1)
        })

        it('holds the countdown while paused from outside (a hidden tab)', () => {
            const onClose = jest.fn()
            render(
                <Notification
                    {...baseNotification}
                    autoDismissMs={1000}
                    paused
                    onClose={onClose}
                />
            )

            act(() => jest.advanceTimersByTime(5000))
            expect(onClose).not.toHaveBeenCalled()
        })
    })

    describe('onLoad callback', () => {
        it('calls onLoad with the notification id on mount', () => {
            const onLoad = jest.fn()
            render(
                <Notification
                    {...baseNotification}
                    onLoad={onLoad}
                />
            )
            expect(onLoad).toHaveBeenCalledWith('notif-1')
        })
    })

    describe('close interaction', () => {
        it('calls onClose with the notification id when close button is clicked', () => {
            const onClose = jest.fn()
            render(
                <Notification
                    {...baseNotification}
                    onClose={onClose}
                />
            )
            fireEvent.click(screen.getByRole('button'))
            expect(onClose).toHaveBeenCalledWith('notif-1')
        })
    })
})
