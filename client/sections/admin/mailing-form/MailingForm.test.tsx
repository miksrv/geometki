import React from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ApiType } from '@/api'

import { MailingForm } from './MailingForm'

dayjs.extend(utc)

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

const mutation = () => [jest.fn(), { isLoading: false }]

const mockCreateMailing = jest.fn()
const mockUploadImage = jest.fn()
const unwrapped = (value: unknown) => ({ unwrap: () => Promise.resolve(value) })

jest.mock('@/api', () => ({
    API: {
        useMailingsDeleteImageMutation: () => mutation(),
        useMailingsDeleteMutation: () => mutation(),
        useMailingsGetAudienceQuery: () => ({ data: { total: 10 } }),
        useMailingsPatchMutation: () => mutation(),
        useMailingsPostCancelMutation: () => mutation(),
        useMailingsPostImageMutation: () => [mockUploadImage, { isLoading: false }],
        useMailingsPostMutation: () => [mockCreateMailing, { isLoading: false }],
        useMailingsPostSendMutation: () => mutation(),
        useMailingsPostTestMutation: () => mutation()
    }
}))

jest.mock('./MailingImage', () => ({
    MailingImage: ({ src, readOnly, onSelect }: any) => (
        <div
            data-testid={'mailing-image'}
            data-src={src ?? ''}
            data-readonly={String(!!readOnly)}
        >
            <button onClick={() => onSelect(new File(['x'], 'letter.png', { type: 'image/png' }))}>pick</button>
        </div>
    )
}))

jest.mock('./MailingPreview', () => ({ MailingPreview: () => <div data-testid={'preview'} /> }))

jest.mock('@/components/shared', () => ({
    ConfirmationDialog: ({ open, message }: any) => (open ? <div role={'dialog'}>{message}</div> : null),
    MAILING_STATUS_TONES: {},
    StatusBadge: ({ label }: any) => <span>{label}</span>
}))

jest.mock('@/components/ui', () => ({
    ...jest.requireActual('@/components/ui/field-hint'),
    FormActions: ({ onSave, onDelete }: any) => (
        <div>
            <button onClick={onSave}>save</button>
            {onDelete && <button onClick={onDelete}>delete</button>}
        </div>
    ),
    FormSection: ({ title, children }: any) => (
        <section aria-label={title}>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    StatTiles: ({ items }: any) => (
        <ul>
            {items.map((item: { key: string; label: string; value: string }) => (
                <li key={item.key}>{`${item.label}:${item.value}`}</li>
            ))}
        </ul>
    )
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled }: any) => (
        <button
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Container: ({ children }: any) => <div>{children}</div>,
    Input: ({ label, error, onChange, onBlur, disabled, value, name }: any) => (
        <label>
            {label}
            <input
                name={name}
                value={value}
                disabled={disabled}
                onChange={onChange}
                onBlur={onBlur}
            />
            {error && <span role={'alert'}>{error}</span>}
        </label>
    ),
    Message: ({ children }: any) => <div role={'status'}>{children}</div>,
    Skeleton: () => <div />,
    TextArea: ({ label, onChange, value, name, disabled }: any) => (
        <label>
            {label}
            <textarea
                name={name}
                value={value}
                disabled={disabled}
                onChange={onChange}
            />
        </label>
    )
}))

const mailing: ApiType.Mailings.MailingAdmin = {
    author: null,
    button_label: null,
    button_url: null,
    completed_at: null,
    content: 'Текст',
    created_at: '2026-11-15 10:00:00',
    delivery: { failed: 1, pending: 0, rejected: 0, sent: 9 },
    id: 'm1',
    image: null,
    recipients: 10,
    sent_at: '2026-11-15 11:00:00',
    status: 'draft',
    subject: 'Тема',
    updated_at: '2026-11-15 10:00:00'
}

const subject = () => screen.getByLabelText('admin-mailing-subject') as HTMLInputElement

describe('MailingForm', () => {
    it('lets a draft be edited, tested and sent', () => {
        render(<MailingForm mailing={mailing} />)

        expect(subject()).toBeEnabled()
        expect(screen.getByText('admin-mailing-test')).toBeEnabled()
        expect(screen.getByText('admin-mailing-send')).toBeEnabled()
        expect(screen.getByText('delete')).toBeInTheDocument()
    })

    it('asks before sending and says how many users get it', () => {
        render(<MailingForm mailing={mailing} />)

        fireEvent.click(screen.getByText('admin-mailing-send'))

        expect(screen.getByRole('dialog')).toHaveTextContent('admin-mailing-send-confirm')
    })

    it('has one set of texts, in Russian only', () => {
        render(<MailingForm mailing={mailing} />)

        expect(screen.getAllByLabelText('admin-mailing-subject')).toHaveLength(1)
        expect(screen.getAllByLabelText('admin-mailing-content')).toHaveLength(1)
        expect(screen.queryByText(/language-name/)).not.toBeInTheDocument()
    })

    it('disables the test and the sending while there are unsaved changes, with the reason', () => {
        render(<MailingForm mailing={mailing} />)

        fireEvent.change(subject(), { target: { value: 'Новая тема' } })

        expect(screen.getByText('admin-mailing-test')).toBeDisabled()
        expect(screen.getByText('admin-mailing-send')).toBeDisabled()
        expect(screen.getByText('admin-mailing-send-unsaved')).toBeInTheDocument()
    })

    it('shows the preview of the letter in its mode, with saving and sending within reach', () => {
        render(
            <MailingForm
                mailing={mailing}
                mode={'preview'}
            />
        )

        expect(screen.getByTestId('preview')).toBeInTheDocument()
        expect(screen.queryByLabelText('admin-mailing-subject')).not.toBeInTheDocument()
        expect(screen.getByText('save')).toBeInTheDocument()
        expect(screen.getByText('admin-mailing-send')).toBeInTheDocument()
    })

    it('shows a sent mailing read-only with its delivery numbers', () => {
        render(<MailingForm mailing={{ ...mailing, status: 'sending' }} />)

        expect(subject()).toBeDisabled()
        expect(screen.getByText('admin-mailing-delivery-sent:9')).toBeInTheDocument()
        expect(screen.getByText('admin-mailing-cancel-sending')).toBeInTheDocument()
        expect(screen.queryByText('admin-mailing-send')).not.toBeInTheDocument()
        expect(screen.queryByText('save')).not.toBeInTheDocument()
    })

    it('keeps the picture of a new mailing and uploads it right after the first save', async () => {
        const createObjectURL = jest.fn(() => 'blob:letter')
        Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() })
        mockCreateMailing.mockReturnValue(unwrapped({ ...mailing, id: 'new1' }))
        mockUploadImage.mockReturnValue(unwrapped(mailing))

        render(<MailingForm />)

        fireEvent.click(screen.getByText('pick'))

        expect(screen.getByTestId('mailing-image')).toHaveAttribute('data-src', 'blob:letter')
        expect(mockUploadImage).not.toHaveBeenCalled()

        fireEvent.change(subject(), { target: { value: 'Тема' } })
        fireEvent.change(screen.getByLabelText('admin-mailing-content'), { target: { value: 'Текст' } })
        fireEvent.click(screen.getByText('save'))

        await waitFor(() => expect(mockUploadImage).toHaveBeenCalledWith({ file: expect.any(File), id: 'new1' }))
    })

    it('shows the picture of a sent mailing without changing it', () => {
        render(<MailingForm mailing={{ ...mailing, status: 'completed' }} />)

        expect(screen.getByTestId('mailing-image')).toHaveAttribute('data-readonly', 'true')
    })

    it('stands disabled while the mailing loads', () => {
        render(<MailingForm loading={true} />)

        expect(subject()).toBeDisabled()
        expect(screen.queryByTestId('preview')).not.toBeInTheDocument()
    })
})
