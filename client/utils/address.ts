import { ApiModel } from '@/api'

export const addressToString = (location?: ApiModel.Address): ApiModel.AddressItem[] => {
    const address: ApiModel.AddressItem[] = []

    if (location?.country?.id) {
        address.push({
            id: location.country.id,
            name: location.country.name,
            slug: location.country.slug,
            type: 'country'
        })
    }

    if (location?.locality?.id) {
        address.push({
            id: location.locality.id,
            name: location.locality.name,
            slug: location.locality.slug,
            type: 'locality'
        })
    } else if (location?.district?.id) {
        address.push({
            id: location.district.id,
            name: location.district.name,
            slug: location.district.slug,
            type: 'district'
        })
    } else if (location?.region?.id) {
        address.push({
            id: location.region.id,
            name: location.region.name,
            slug: location.region.slug,
            type: 'region'
        })
    }

    return address
}
