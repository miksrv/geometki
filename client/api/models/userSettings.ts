export type UserSettings = {
    emailComment?: boolean
    emailEdit?: boolean
    emailPhoto?: boolean
    emailPlace?: boolean
    emailRating?: boolean
    emailCover?: boolean
    emailDigest?: boolean
}

export const UserSettingTypes = {
    Comment: 'comment',
    Cover: 'cover',
    Edit: 'edit',
    Photo: 'photo',
    Place: 'place',
    Rating: 'rating'
} as const

export type UserSettingEnum = (typeof UserSettingTypes)[keyof typeof UserSettingTypes]
