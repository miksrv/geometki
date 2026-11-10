import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { PlaceForm } from './PlaceForm'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick, disabled }: any) => (
        <button
            type={'button'}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Container: ({ id, title, children }: any) => (
        <section id={id}>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Input: ({ label, value, onChange, name, error }: any) => (
        <>
            <input
                aria-label={label}
                name={name}
                value={value}
                onChange={onChange ?? (() => undefined)}
            />
            {error && <span>{error}</span>}
        </>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Select: ({ label, 'data-field': dataField, error }: any) => (
        <div data-field={dataField}>
            <button type={'button'}>{label}</button>
            {error && <span>{error}</span>}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Message: ({ children }: any) => <div>{children}</div>,
    Icon: () => null,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('next/dynamic', () => () => () => <div data-testid={'map'} />)
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

jest.mock('@/api', () => ({
    API: { usePoiGetListQuery: () => ({ data: undefined }) }
}))

jest.mock('@/components/shared', () => ({
    PhotoGallery: () => null,
    PhotoUploader: () => null
}))

jest.mock('@/components/ui', () => ({
    ...jest.requireActual('@/components/ui/form-actions'),
    ...jest.requireActual('@/components/ui/form-sections'),
    ContentEditor: () => <textarea />,
    FileDropZone: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    UploadZone: ({ title }: { title: string }) => <button type={'button'}>{title}</button>
}))

jest.mock('@/utils/categories', () => ({
    categoryImage: () => ({ src: '' }),
    getCategoryOptions: () => [{ key: 'waterfall', value: 'Водопад' }]
}))

const place = { category: 'waterfall', content: '', lat: 55.7558, lon: 37.6173, title: 'Водопад Девичьи слёзы' }

describe('PlaceForm', () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = jest.fn()
    })

    it('is split into titled parts, the photos only for a new place', () => {
        const { rerender } = render(<PlaceForm />)

        expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toStrictEqual([
            'place-form-section-main',
            'place-form-section-location',
            'description',
            'photos'
        ])

        rerender(
            <PlaceForm
                placeId={'p1'}
                values={place}
            />
        )

        expect(screen.queryByRole('heading', { name: 'photos' })).not.toBeInTheDocument()
    })

    it('lists the parts in the side menu, the photos only for a new place', () => {
        const { rerender } = render(<PlaceForm />)

        const menu = () => screen.getByRole('navigation', { name: 'place-form-sections' })
        expect(menu()).toHaveTextContent('photos')
        expect(screen.getByRole('link', { name: 'place-form-section-main' })).toHaveAttribute('href', '#place-main')

        rerender(
            <PlaceForm
                placeId={'p1'}
                values={place}
            />
        )

        expect(menu()).not.toHaveTextContent('photos')
    })

    it('puts Cancel before the create button, which works without changes', () => {
        render(
            <PlaceForm
                values={place}
                onCancel={jest.fn()}
            />
        )

        const buttons = screen
            .getAllByRole('button')
            .filter(
                ({ textContent }) => !['input_category-label', 'place-form-photos-empty'].includes(textContent ?? '')
            )
        expect(buttons.map((button) => button.textContent)).toStrictEqual(['cancel', 'place-form-submit-create'])
        expect(screen.getByRole('button', { name: 'place-form-submit-create' })).toBeEnabled()
    })

    it('saves an edit only after a change', () => {
        render(
            <PlaceForm
                placeId={'p1'}
                values={place}
            />
        )

        expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()

        fireEvent.change(screen.getByLabelText('input_geotag-label'), { target: { value: 'Новое название' } })

        expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
    })

    it('brings the first field with an error into view instead of saving', async () => {
        const onSubmit = jest.fn()
        render(<PlaceForm onSubmit={onSubmit} />)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'place-form-submit-create' }))
        })

        expect(onSubmit).not.toHaveBeenCalled()
        expect(document.activeElement).toHaveAttribute('name', 'title')
        expect(screen.getAllByText('error_title-required').length).toBeGreaterThan(0)
    })

    it('checks the title length as the API does', async () => {
        const onSubmit = jest.fn()
        render(
            <PlaceForm
                values={place}
                onSubmit={onSubmit}
            />
        )

        fireEvent.change(screen.getByLabelText('input_geotag-label'), { target: { value: '  Озеро  ' } })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'place-form-submit-create' }))
        })

        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getAllByText('error_title-too-short').length).toBeGreaterThan(0)
    })

    it('keeps an old short title of an edited place, trims a new one', async () => {
        const onSubmit = jest.fn()
        const { unmount } = render(
            <PlaceForm
                placeId={'p1'}
                values={{ ...place, title: 'Утёс' }}
                onSubmit={onSubmit}
            />
        )

        fireEvent.change(screen.getByLabelText('input_geotag-label'), { target: { value: 'Утёс' } })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'save' }))
        })
        // Nothing changed: nothing to save, and no error either
        expect(screen.queryByText('error_title-too-short')).not.toBeInTheDocument()
        unmount()

        render(
            <PlaceForm
                values={place}
                onSubmit={onSubmit}
            />
        )
        fireEvent.change(screen.getByLabelText('input_geotag-label'), {
            target: { value: '  Водопад Девичьи слёзы  ' }
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'place-form-submit-create' }))
        })

        expect(onSubmit.mock.calls[0][0].title).toBe('Водопад Девичьи слёзы')
    })

    it('checks a prefilled title of a new place (an OSM candidate) as a typed one', async () => {
        const onSubmit = jest.fn()
        render(
            <PlaceForm
                values={{ ...place, title: 'Утёс' }}
                onSubmit={onSubmit}
            />
        )

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'place-form-submit-create' }))
        })

        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getAllByText('error_title-too-short').length).toBeGreaterThan(0)
    })

    it('does not save a new place before the map gives its position', async () => {
        const onSubmit = jest.fn()
        render(
            <PlaceForm
                values={{ category: 'waterfall', title: 'Водопад Девичьи слёзы' }}
                onSubmit={onSubmit}
            />
        )

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'place-form-submit-create' }))
        })

        expect(onSubmit).not.toHaveBeenCalled()
        // Under the map and once in the summary
        expect(screen.getAllByText('place-form-location-required')).toHaveLength(2)
    })

    it('shows a server error that belongs to no field above the form', () => {
        render(
            <PlaceForm
                values={place}
                errors={{ error: 'Возникла ошибка при создании геометки' }}
            />
        )

        expect(screen.getByText('Возникла ошибка при создании геометки')).toBeInTheDocument()
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })

    it('shows a server error on the coordinates under the map', () => {
        render(
            <PlaceForm
                values={place}
                errors={{ lat: 'Неверные координаты' }}
            />
        )

        expect(screen.getAllByText('Неверные координаты').length).toBeGreaterThan(0)
        expect(screen.queryByText(/coordinates/)).not.toBeInTheDocument()
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    })
})
