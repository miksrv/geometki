import { ApiModel } from '@/api'
import { LOCAL_STORAGE_KEY } from '@/config/constants'

import { getMapSettings, saveMapSettings } from './mapSettings'
import { MapAdditionalLayersEnum, MapLayersEnum, MapObjectsTypeEnum } from './types'

const stored = () => JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}')
const store = (data: Record<string, unknown>) => localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))

describe('mapSettings', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns no settings when nothing is saved', () => {
        expect(getMapSettings()).toEqual({})
    })

    it('saves and reads all settings', () => {
        saveMapSettings({
            additionalLayers: [MapAdditionalLayersEnum.WIKIPEDIA],
            categories: [ApiModel.Categories.bridge],
            layer: MapLayersEnum.OPEN_TOPO,
            osmCandidatesCollapsed: false,
            position: { lat: 51.7, lon: 55.1, zoom: 14 },
            type: MapObjectsTypeEnum.PHOTOS
        })

        expect(getMapSettings()).toEqual({
            additionalLayers: [MapAdditionalLayersEnum.WIKIPEDIA],
            categories: [ApiModel.Categories.bridge],
            layer: MapLayersEnum.OPEN_TOPO,
            osmCandidatesCollapsed: false,
            position: { lat: 51.7, lon: 55.1, zoom: 14 },
            type: MapObjectsTypeEnum.PHOTOS
        })
    })

    it('merges a change into the saved settings', () => {
        saveMapSettings({ layer: MapLayersEnum.OPEN_TOPO })
        saveMapSettings({ categories: [ApiModel.Categories.bridge] })

        expect(getMapSettings()).toMatchObject({
            categories: [ApiModel.Categories.bridge],
            layer: MapLayersEnum.OPEN_TOPO
        })
    })

    it('keeps the other keys of the storage entry', () => {
        store({ locale: 'en' })
        saveMapSettings({ layer: MapLayersEnum.OSM })

        expect(stored().locale).toBe('en')
    })

    it('drops unknown and broken values', () => {
        store({
            mapSettings: {
                additionalLayers: ['OsmCandidates', MapAdditionalLayersEnum.HEATMAP, MapAdditionalLayersEnum.HEATMAP],
                categories: 'bridge',
                layer: 'Removed',
                osmCandidatesCollapsed: 'yes',
                position: { lat: 'x', lon: 55 },
                type: 42
            }
        })

        expect(getMapSettings()).toEqual({
            additionalLayers: [MapAdditionalLayersEnum.HEATMAP],
            categories: undefined,
            layer: undefined,
            osmCandidatesCollapsed: undefined,
            position: undefined,
            type: undefined
        })
    })

    it('drops a saved layer whose key is not set here', () => {
        // No NEXT_PUBLIC_MAPBOX_TOKEN in the tests
        store({ mapSettings: { layer: MapLayersEnum.MAPBOX_SAT } })

        expect(getMapSettings().layer).toBeUndefined()
    })

    it('treats a list of removed categories only as not saved', () => {
        store({ mapSettings: { categories: ['removed'] } })

        expect(getMapSettings().categories).toBeUndefined()
    })

    it('treats a saved empty list of categories as not saved, so the map opens with every category', () => {
        saveMapSettings({ categories: [] })

        expect(getMapSettings().categories).toBeUndefined()
    })

    it('drops a position out of the coordinate range', () => {
        store({ mapSettings: { position: { lat: 120, lon: 55 } } })

        expect(getMapSettings().position).toBeUndefined()
    })

    it('works without localStorage when it throws', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })

        expect(getMapSettings()).toEqual({})
        expect(() => saveMapSettings({ layer: MapLayersEnum.OSM })).not.toThrow()

        jest.restoreAllMocks()
    })

    it('reads the position from the old key and removes it on save', () => {
        store({ mapCenter: { lat: 51.7, lon: 55.1, zoom: 12 } })

        expect(getMapSettings().position).toEqual({ lat: 51.7, lon: 55.1, zoom: 12 })

        saveMapSettings({ layer: MapLayersEnum.OSM })

        expect(stored().mapCenter).toBeUndefined()
        expect(stored().mapSettings.position).toEqual({ lat: 51.7, lon: 55.1, zoom: 12 })
    })
})
