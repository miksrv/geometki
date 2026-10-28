import { ApiModel } from '@/api'

import { buildPlaceAddress, getPlaceSchemaType, isStreetName, PlaceSchema, UserSchema } from './schema'

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://cdn.example.com/'
}))

const mockPlace: Partial<ApiModel.Place> = {
    id: 'place-1',
    title: 'Test Place',
    lat: 55.75,
    lon: 37.62,
    views: 50,
    content: '**Bold** content',
    category: ApiModel.Categories.museum,
    address: {
        country: { id: 'ru', name: 'Russia' },
        region: { id: 'reg1', name: 'Moscow Oblast' },
        locality: { id: 'msk', name: 'Moscow' },
        street: 'Red Square'
    },
    author: { id: 'user-1', name: 'Alice', avatar: '/avatars/alice.jpg' },
    cover: { full: '/covers/place-1.jpg', small: '' },
    created: { date: '2023-01-15T10:00:00Z', timezone_type: 1, timezone: 'UTC' },
    updated: { date: '2024-06-15T12:00:00Z', timezone_type: 1, timezone: 'UTC' }
}

const mockUser: ApiModel.User = {
    id: 'user-1',
    name: 'Alice',
    avatar: '/avatars/alice.jpg'
}

describe('PlaceSchema', () => {
    it('returns an object with @context schema.org', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place)
        expect((schema as Record<string, unknown>)['@context']).toBe('https://schema.org')
    })

    it('uses LocalBusiness type for museum category', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place)
        expect((schema as Record<string, unknown>)['@type']).toBe('LocalBusiness')
    })

    it('uses TouristAttraction type for non-commercial categories', () => {
        const nonCommercialPlace = {
            ...mockPlace,
            category: ApiModel.Categories.memorial
        }
        const schema = PlaceSchema(nonCommercialPlace as ApiModel.Place)
        expect((schema as Record<string, unknown>)['@type']).toBe('TouristAttraction')
    })

    it('uses TouristAttraction type when category is undefined', () => {
        const noCategory = { ...mockPlace, category: undefined }
        const schema = PlaceSchema(noCategory as ApiModel.Place)
        expect((schema as Record<string, unknown>)['@type']).toBe('TouristAttraction')
    })

    it('includes the place title as name', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place) as Record<string, unknown>
        expect(schema.name).toBe('Test Place')
    })

    it('includes geo coordinates', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place) as Record<string, unknown>
        expect((schema.geo as Record<string, unknown>).latitude).toBe(55.75)
        expect((schema.geo as Record<string, unknown>).longitude).toBe(37.62)
    })

    it('strips markdown from description', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place) as Record<string, unknown>
        // 'removeMarkdown' strips **Bold** → 'Bold content'
        expect(schema.description).toBe('Bold content')
    })

    it('includes the canonical URL when provided', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place, 'https://geometki.com/') as Record<string, unknown>
        expect(schema.url).toBe('https://geometki.com/places/place-1')
    })

    it('constructs the cover image URL from IMG_HOST', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place) as Record<string, unknown>
        expect(schema.image).toBe('https://cdn.example.com//covers/place-1.jpg')
    })

    it('returns undefined for image when cover is not set', () => {
        const noCoverPlace = { ...mockPlace, cover: undefined }
        const schema = PlaceSchema(noCoverPlace as ApiModel.Place) as Record<string, unknown>
        expect(schema.image).toBeUndefined()
    })

    it('leaves out the author and the dates: they are not properties of a place', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place, 'https://geometki.com/') as Record<string, unknown>
        expect(schema.author).toBeUndefined()
        expect(schema.datePublished).toBeUndefined()
        expect(schema.dateModified).toBeUndefined()
    })

    it('includes view count in interactionStatistic', () => {
        const schema = PlaceSchema(mockPlace as ApiModel.Place) as Record<string, unknown>
        expect((schema.interactionStatistic as Record<string, unknown>).userInteractionCount).toBe(50)
    })
})

describe('UserSchema', () => {
    it('returns an object with @context schema.org', () => {
        const schema = UserSchema(mockUser) as Record<string, unknown>
        expect(schema['@context']).toBe('https://schema.org')
    })

    it('returns @type Person', () => {
        const schema = UserSchema(mockUser) as Record<string, unknown>
        expect(schema['@type']).toBe('Person')
    })

    it('includes the user id as identifier', () => {
        const schema = UserSchema(mockUser) as Record<string, unknown>
        expect(schema.identifier).toBe('user-1')
    })

    it('includes the user name', () => {
        const schema = UserSchema(mockUser) as Record<string, unknown>
        expect(schema.name).toBe('Alice')
    })

    it('constructs the avatar image URL from IMG_HOST', () => {
        const schema = UserSchema(mockUser) as Record<string, unknown>
        expect(schema.image).toBe('https://cdn.example.com//avatars/alice.jpg')
    })

    it('returns undefined for image when avatar is not set', () => {
        const noAvatarUser = { ...mockUser, avatar: undefined }
        const schema = UserSchema(noAvatarUser) as Record<string, unknown>
        expect(schema.image).toBeUndefined()
    })

    it('includes the canonical URL when provided', () => {
        const schema = UserSchema(mockUser, 'https://geometki.com/') as Record<string, unknown>
        expect(schema.url).toBe('https://geometki.com/users/user-1')
    })

    it('returns undefined for url when canonicalUrl is not provided', () => {
        const schema = UserSchema(mockUser) as Record<string, unknown>
        expect(schema.url).toBeUndefined()
    })
})

describe('getPlaceSchemaType', () => {
    it('LocalBusiness only for a commercial category', () => {
        expect(getPlaceSchemaType(ApiModel.Categories.museum)).toBe('LocalBusiness')
    })

    it('TouristAttraction for nature, ruins and an unknown category', () => {
        expect(getPlaceSchemaType(ApiModel.Categories.waterfall)).toBe('TouristAttraction')
        expect(getPlaceSchemaType(undefined)).toBe('TouristAttraction')
    })
})

describe('isStreetName', () => {
    it('accepts a street name', () => {
        expect(isStreetName('ул. Ленина, 5')).toBe(true)
        expect(isStreetName('Red Square')).toBe(true)
    })

    it('rejects a road code, an empty and a missing value', () => {
        expect(isStreetName('80К-007')).toBe(false)
        expect(isStreetName('Р-240')).toBe(false)
        expect(isStreetName('M-5')).toBe(false)
        expect(isStreetName('')).toBe(false)
        expect(isStreetName(undefined)).toBe(false)
    })
})

describe('buildPlaceAddress', () => {
    it('leaves a road code out of streetAddress', () => {
        const address = buildPlaceAddress({ country: { id: 1, name: 'Russia' }, street: '80К-007' })
        expect(address.streetAddress).toBeUndefined()
        expect(address.addressCountry).toStrictEqual({ '@type': 'Country', name: 'Russia' })
    })

    it('has no country without one', () => {
        expect(buildPlaceAddress(undefined).addressCountry).toBeUndefined()
    })
})
