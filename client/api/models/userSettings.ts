/**
 * What a user can be notified about, in the order the settings page shows it
 * (server: `app/Config/Notifications.php`).
 */
export const NotificationTypes = [
    'comment',
    'photo',
    'rating',
    'edit',
    'cover',
    'bookmark',
    'visit',
    'digest',
    'achievement',
    'level'
] as const

export type NotificationType = (typeof NotificationTypes)[number]

/** Delivery channels a user switches per type */
export const NotificationChannels = ['email', 'push'] as const

export type NotificationChannel = (typeof NotificationChannels)[number]

/** The types each channel carries: the digest is email only, achievements and levels push only */
export const NotificationChannelTypes: Record<NotificationChannel, readonly NotificationType[]> = {
    email: ['comment', 'photo', 'rating', 'edit', 'cover', 'bookmark', 'visit', 'digest'],
    push: ['comment', 'photo', 'rating', 'edit', 'cover', 'bookmark', 'visit', 'achievement', 'level']
}

export type UserSettingKey = `${NotificationChannel}${Capitalize<NotificationType>}`

/** `users.settings`: one boolean per `{channel}{Type}`, e.g. `emailComment`, `pushLevel`; a missing key means on */
export type UserSettings = Partial<Record<UserSettingKey, boolean>>

export const userSettingKey = (channel: NotificationChannel, type: NotificationType): UserSettingKey =>
    `${channel}${type.charAt(0).toUpperCase()}${type.slice(1)}` as UserSettingKey

/** Every settings key, channel by channel */
export const userSettingKeys = (): UserSettingKey[] =>
    NotificationChannels.flatMap((channel) =>
        NotificationChannelTypes[channel].map((type) => userSettingKey(channel, type))
    )
