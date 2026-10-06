export type UserSettings = {
    emailComment?: boolean
    emailEdit?: boolean
    emailPhoto?: boolean
    emailPlace?: boolean
    emailRating?: boolean
    emailCover?: boolean
    emailBookmark?: boolean
    emailVisit?: boolean
    emailDigest?: boolean
}

export const UserSettingTypes = {
    Bookmark: 'bookmark',
    Comment: 'comment',
    Cover: 'cover',
    Edit: 'edit',
    Photo: 'photo',
    Place: 'place',
    Rating: 'rating',
    Visit: 'visit'
} as const

export type UserSettingEnum = (typeof UserSettingTypes)[keyof typeof UserSettingTypes]
