import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { SeasonForm } from './SeasonForm'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

jest.mock('@/app/store', () => ({ useAppDispatch: () => jest.fn() }))

jest.mock('@/hooks/useUnsavedChangesGuard', () => ({
    useUnsavedChangesGuard: () => ({
        allowNavigation: jest.fn(),
        confirmDiscard: (discard: () => void) => discard(),
        dialogProps: { message: '', onCancel: jest.fn(), onConfirm: jest.fn(), open: false }
    })
}))

jest.mock('@/api', () => ({
    API: {
        useGameDeleteSeasonMutation: () => [jest.fn(), { isLoading: false }],
        useGamePatchSeasonMutation: () => [jest.fn(), { isLoading: false }],
        useGamePostSeasonMutation: () => [jest.fn(), { isLoading: false }]
    }
}))

jest.mock('./SeasonImages', () => ({ SeasonImages: () => <div data-testid={'images'} /> }))

jest.mock('@/components/shared', () => ({
    ConfirmationDialog: () => null
}))

// The page form's frame is its own component's business: stand-ins that show what the form hands them
jest.mock('@/components/ui', () => ({
    ...jest.requireActual('@/components/ui/field-hint'),
    ...jest.requireActual('@/components/ui/locale-field-pair'),
    DateField: ({ label, error, onChange, disabled, value }: any) => (
        <label>
            {label}
            <input
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
            {error && <span role={'alert'}>{error}</span>}
        </label>
    ),
    FormActions: ({ onSave, onDelete, saveDisabled, disabled }: any) => (
        <div>
            <span data-testid={'actions-disabled'}>{String(!!disabled)}</span>
            <button onClick={onSave}>save</button>
            {onDelete && <button onClick={onDelete}>delete</button>}
            <span data-testid={'save-disabled'}>{String(saveDisabled)}</span>
        </div>
    ),
    FormSections: ({ sections, children }: any) => (
        <div>
            <nav>
                {sections.map(({ key, title }: any) => (
                    <a
                        key={key}
                        href={'#' + String(key)}
                    >
                        {title}
                    </a>
                ))}
            </nav>
            {children}
        </div>
    ),
    FormSection: ({ title, children }: any) => (
        <section aria-label={title}>
            <h2>{title}</h2>
            {children}
        </section>
    )
}))

jest.mock('simple-react-ui-kit', () => ({
    Input: ({ label, error, onChange, onBlur, value, name }: any) => (
        <label>
            {label}
            <input
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
            />
            {error && <span role={'alert'}>{error}</span>}
        </label>
    ),
    Message: ({ children }: any) => <div role={'status'}>{children}</div>,
    TextArea: ({ label, onChange, value, name }: any) => (
        <label>
            {label}
            <textarea
                name={name}
                value={value}
                onChange={onChange}
            />
        </label>
    )
}))

const season: ApiType.Game.SeasonAdmin = {
    closed: false,
    closed_at: null,
    current: true,
    datesLocked: false,
    description_en: null,
    description_ru: null,
    ends_on: '2027-03-31',
    id: '6f1c2a9e0b3d4',
    slug: 'kholodnyy-sezon',
    image: null,
    medals: { bronze: null, gold: null, participant: null, silver: null },
    places: 0,
    players: 0,
    points: 0,
    startLocked: false,
    starts_on: '2026-10-01',
    title_en: null,
    title_ru: 'Холодный сезон',
    upcoming: false
}

const date = (label: string) => screen.getByLabelText(new RegExp(label)) as HTMLInputElement

describe('SeasonForm', () => {
    it('locks the dates the server freezes: a closed season, or one past its grace days', () => {
        render(<SeasonForm season={{ ...season, datesLocked: true, startLocked: true }} />)

        expect(date('game-season-form-starts')).toBeDisabled()
        expect(date('game-season-form-ends')).toBeDisabled()
    })

    it('locks only the start of a season with points', () => {
        render(<SeasonForm season={{ ...season, points: 3, startLocked: true }} />)

        expect(date('game-season-form-starts')).toBeDisabled()
        expect(date('game-season-form-ends')).toBeEnabled()
    })

    it('leaves the dates of an open season to edit', () => {
        render(<SeasonForm season={season} />)

        expect(date('game-season-form-starts')).toBeEnabled()
        expect(date('game-season-form-ends')).toBeEnabled()
    })

    it('offers to delete only a season still to come, without a word why not', () => {
        const { unmount } = render(<SeasonForm season={{ ...season, current: false, upcoming: true }} />)

        expect(screen.getByRole('button', { name: 'delete' })).toBeInTheDocument()

        unmount()
        // Begun, nothing counted yet: it stays
        render(<SeasonForm season={season} />)

        expect(screen.queryByRole('button', { name: 'delete' })).not.toBeInTheDocument()
    })

    it('lists its parts in the side menu, the pictures once the season exists', () => {
        const { unmount } = render(<SeasonForm season={season} />)

        expect(screen.getByRole('link', { name: 'game-season-form-images' })).toHaveAttribute('href', '#images')

        unmount()
        render(<SeasonForm />)

        expect(screen.getByRole('link', { name: 'game-season-form-section-dates' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'game-season-form-images' })).not.toBeInTheDocument()
    })

    it('has no delete for a new season, and its Save is not waiting for a change', () => {
        render(<SeasonForm />)

        expect(screen.queryByRole('button', { name: 'delete' })).not.toBeInTheDocument()
        expect(screen.getByTestId('save-disabled')).toHaveTextContent('false')
        expect(screen.queryByTestId('images')).not.toBeInTheDocument()
    })

    it('shows the pictures of an existing season only', () => {
        render(<SeasonForm season={season} />)

        expect(screen.getByTestId('images')).toBeInTheDocument()
    })

    it('says the last day is before the first when saving', async () => {
        render(<SeasonForm season={season} />)

        fireEvent.change(date('game-season-form-ends'), { target: { value: '2026-09-01' } })
        fireEvent.click(screen.getByRole('button', { name: 'save' }))

        expect(await screen.findByText('admin-dates-order')).toBeInTheDocument()
    })

    it('asks for the Russian title, the English one stays optional', async () => {
        render(<SeasonForm season={{ ...season, title_ru: '' }} />)

        fireEvent.click(screen.getByRole('button', { name: 'save' }))

        const alerts = await screen.findAllByRole('alert')

        expect(alerts).toHaveLength(1)
        expect(alerts[0]).toHaveTextContent('admin-field-required')
    })
})
