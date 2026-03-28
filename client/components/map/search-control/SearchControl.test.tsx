import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/api', () => ({
    API: {
        useLocationGetGeoSearchMutation: jest.fn().mockReturnValue([
            jest.fn(),
            { data: undefined, isLoading: false }
        ])
    }
}))

jest.mock('@/components/ui', () => ({
    Autocomplete: ({ placeholder, className }: any) => (
        <input data-testid={'autocomplete'} placeholder={placeholder} className={className} />
    )
}))

jest.mock('@/utils/coordinates', () => ({
    normalizeInput: jest.fn((v: string) => v),
    isCoordinates: jest.fn().mockReturnValue(false),
    CoordinatesD: { fromString: jest.fn().mockReturnValue({ error: true }) },
    CoordinatesDM: { fromString: jest.fn().mockReturnValue({ error: true }) },
    CoordinatesDMS: { fromString: jest.fn().mockReturnValue({ error: true }) },
    CoordinatesDSigned: { fromString: jest.fn().mockReturnValue({ error: true }) }
}))

jest.mock('lodash-es/debounce', () => (fn: Function) => fn)

import { SearchControl } from './SearchControl'

describe('SearchControl', () => {
    it('renders the Autocomplete with the correct placeholder', () => {
        render(<SearchControl />)
        expect(screen.getByTestId('autocomplete')).toHaveAttribute(
            'placeholder',
            'Поиск населенного пункта или координат'
        )
    })
})
