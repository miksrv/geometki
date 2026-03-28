import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { MapLayersEnum } from '../types'

import { LayerSwitcherControl } from './LayerSwitcherControl'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, onClick, mode }: any) => (
        <button
            data-icon={icon}
            data-mode={mode}
            onClick={onClick}
        />
    ),
    Container: ({ children, className }: any) => <div className={className}>{children}</div>,
    Checkbox: ({ id, label, checked, onChange }: any) => (
        <label>
            <input
                type={'checkbox'}
                id={id}
                checked={!!checked}
                onChange={onChange}
            />
            {label}
        </label>
    ),
    cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/components/ui', () => ({
    RadioButton: ({ id, label, checked, onChange }: any) => (
        <label>
            <input
                type={'radio'}
                id={id}
                checked={!!checked}
                onChange={onChange}
            />
            {label}
        </label>
    )
}))

describe('LayerSwitcherControl', () => {
    describe('closed state', () => {
        it('renders the Layers button when closed', () => {
            render(<LayerSwitcherControl />)
            expect(screen.getByRole('button')).toHaveAttribute('data-icon', 'Layers')
        })

        it('does not render layer options when closed', () => {
            render(<LayerSwitcherControl />)
            expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument()
        })
    })

    describe('open state', () => {
        it('opens the panel when Layers button is clicked', () => {
            render(<LayerSwitcherControl />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByText('OpenStreetMap')).toBeInTheDocument()
        })

        it('renders all map layer options', () => {
            render(<LayerSwitcherControl />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByText('OpenStreetMap')).toBeInTheDocument()
            expect(screen.getByText('Google Карты')).toBeInTheDocument()
            expect(screen.getByText('Google Спутник')).toBeInTheDocument()
        })

        it('renders map type options when hideAdditionalLayers is false', () => {
            render(<LayerSwitcherControl />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByText('Places')).toBeInTheDocument()
            expect(screen.getByText('Photos')).toBeInTheDocument()
        })

        it('does not render map type options when hideAdditionalLayers is true', () => {
            render(<LayerSwitcherControl hideAdditionalLayers />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.queryByText('Places')).not.toBeInTheDocument()
        })

        it('renders heatmap and historical photos when hideAdditionalLayers is false', () => {
            render(<LayerSwitcherControl />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByText('Heatmap')).toBeInTheDocument()
            expect(screen.getByText('Historical Photos')).toBeInTheDocument()
        })

        it('marks the current layer as checked', () => {
            render(<LayerSwitcherControl currentLayer={MapLayersEnum.OSM} />)
            fireEvent.click(screen.getByRole('button'))
            const osmRadio = document.querySelector(`input[id="${MapLayersEnum.OSM}"]`) as HTMLInputElement
            expect(osmRadio.checked).toBe(true)
        })
    })
})
