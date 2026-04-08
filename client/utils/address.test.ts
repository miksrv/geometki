import { ApiModel } from '@/api'

import { addressToString } from './address'

type PartialAddress = unknown

describe('addressToString', () => {
    it('returns an empty array when location is undefined', () => {
        expect(addressToString(undefined)).toStrictEqual([])
    })

    it('returns an empty array when location has no known ids', () => {
        expect(addressToString({})).toStrictEqual([])
    })

    it('includes country when country.id is set', () => {
        const location = { country: { id: 'ru', name: 'Russia' } }
        const result = addressToString(location as PartialAddress as ApiModel.Address)
        expect(result).toContainEqual({ id: 'ru', name: 'Russia', type: 'country' })
    })

    it('includes locality when locality.id is set', () => {
        const location = {
            country: { id: 'ru', name: 'Russia' },
            locality: { id: 'msk', name: 'Moscow' }
        }
        const result = addressToString(location as PartialAddress as ApiModel.Address)
        expect(result).toContainEqual({ id: 'msk', name: 'Moscow', type: 'locality' })
    })

    it('uses district when locality is absent', () => {
        const location = {
            country: { id: 'ru', name: 'Russia' },
            district: { id: 'd1', name: 'Central District' }
        }
        const result = addressToString(location as PartialAddress as ApiModel.Address)
        expect(result).toContainEqual({ id: 'd1', name: 'Central District', type: 'district' })
    })

    it('uses region when both locality and district are absent', () => {
        const location = {
            country: { id: 'ru', name: 'Russia' },
            region: { id: 'reg1', name: 'Moscow Oblast' }
        }
        const result = addressToString(location as PartialAddress as ApiModel.Address)
        expect(result).toContainEqual({ id: 'reg1', name: 'Moscow Oblast', type: 'region' })
    })

    it('prefers locality over district', () => {
        const location = {
            locality: { id: 'loc1', name: 'City' },
            district: { id: 'dist1', name: 'District' }
        }
        const result = addressToString(location as PartialAddress as ApiModel.Address)
        const types = result.map((item) => item.type)
        expect(types).toContain('locality')
        expect(types).not.toContain('district')
    })

    it('returns at most 2 items (country + one sub-unit)', () => {
        const location = {
            country: { id: 'ru', name: 'Russia' },
            locality: { id: 'msk', name: 'Moscow' },
            district: { id: 'd1', name: 'District' },
            region: { id: 'r1', name: 'Region' }
        }
        expect(addressToString(location as PartialAddress as ApiModel.Address).length).toBeLessThanOrEqual(2)
    })

    it('skips country when country.id is absent', () => {
        const location = { country: { name: 'Unknown' }, locality: { id: 'loc1', name: 'City' } }
        const result = addressToString(location as PartialAddress as ApiModel.Address)
        const types = result.map((item) => item.type)
        expect(types).not.toContain('country')
        expect(types).toContain('locality')
    })
})
