import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { MapLayersEnum, MapObjectLayersEnum } from '../types'

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

        it('does not offer the hidden "Геометки / Фотографии" switch', () => {
            render(<LayerSwitcherControl />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.queryByText('Photos')).not.toBeInTheDocument()
        })

        it('renders the objects group when the objects are passed', () => {
            render(<LayerSwitcherControl objectLayers={[MapObjectLayersEnum.PLACES]} />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByLabelText('Неоткрытые')).not.toBeChecked()
            expect(screen.getByLabelText('Геометки')).toBeChecked()
            expect(screen.getByLabelText('Геоквесты')).not.toBeChecked()
        })

        it('switches an object on in the order of the panel', () => {
            const onSwitch = jest.fn()
            render(
                <LayerSwitcherControl
                    objectLayers={[MapObjectLayersEnum.QUESTS]}
                    onSwitchObjectLayers={onSwitch}
                />
            )
            fireEvent.click(screen.getByRole('button'))
            fireEvent.click(screen.getByLabelText('Неоткрытые'))
            expect(onSwitch).toHaveBeenCalledWith([MapObjectLayersEnum.UNEXPLORED, MapObjectLayersEnum.QUESTS])
        })

        it('switches an object off', () => {
            const onSwitch = jest.fn()
            render(
                <LayerSwitcherControl
                    objectLayers={[MapObjectLayersEnum.PLACES, MapObjectLayersEnum.QUESTS]}
                    onSwitchObjectLayers={onSwitch}
                />
            )
            fireEvent.click(screen.getByRole('button'))
            fireEvent.click(screen.getByLabelText('Геометки'))
            expect(onSwitch).toHaveBeenCalledWith([MapObjectLayersEnum.QUESTS])
        })

        it('does not render the objects group when hideAdditionalLayers is true', () => {
            render(
                <LayerSwitcherControl
                    hideAdditionalLayers
                    objectLayers={[MapObjectLayersEnum.PLACES]}
                />
            )
            fireEvent.click(screen.getByRole('button'))
            expect(screen.queryByText('Геометки')).not.toBeInTheDocument()
        })

        it('renders historical photos when hideAdditionalLayers is false', () => {
            render(<LayerSwitcherControl />)
            fireEvent.click(screen.getByRole('button'))
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
