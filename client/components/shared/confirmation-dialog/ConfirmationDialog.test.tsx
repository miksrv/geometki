import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { ConfirmationDialog } from './ConfirmationDialog'

jest.mock('cookies-next', () => ({
    getCookie: jest.fn(() => ''),
    setCookie: jest.fn()
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn(() => ''),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) => opts?.defaultValue ?? key
    })
}))

// Mock simple-react-ui-kit Dialog and Button
jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, variant, mode }: any) => (
        <button
            data-variant={variant}
            data-mode={mode}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Dialog: ({ open, children, onCloseDialog }: any) =>
        open ? (
            <div
                data-testid={'dialog'}
                onClick={(e) => e.target === e.currentTarget && onCloseDialog?.()}
            >
                {children}
            </div>
        ) : null
}))

// Suppress react-image-crop scss import
jest.mock('react-image-crop/src/ReactCrop.scss', () => {}, { virtual: true })

const makeStore = () =>
    configureStore({
        reducer: {
            application: applicationReducer,
            auth: authReducer,
            notification: notificationReducer
        }
    })

const renderWithStore = (ui: React.ReactElement) => {
    const store = makeStore()
    return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}

describe('ConfirmationDialog', () => {
    describe('when closed', () => {
        it('renders nothing when open is false', () => {
            const { container } = renderWithStore(<ConfirmationDialog open={false} />)
            expect(container.firstChild).toBeNull()
        })
    })

    describe('when open', () => {
        it('renders the dialog element', () => {
            renderWithStore(<ConfirmationDialog open />)
            expect(screen.getByTestId('dialog')).toBeInTheDocument()
        })

        it('renders custom message when provided', () => {
            renderWithStore(
                <ConfirmationDialog
                    open
                    message={'Are you sure?'}
                />
            )
            expect(screen.getByText('Are you sure?')).toBeInTheDocument()
        })

        it('renders default message via translation key when message is omitted', () => {
            renderWithStore(<ConfirmationDialog open />)
            // The t mock returns the key as-is
            expect(screen.getByText('confirmation-dialog-text')).toBeInTheDocument()
        })

        it('renders accept and reject buttons', () => {
            renderWithStore(<ConfirmationDialog open />)
            // Buttons render with the i18n key as text
            expect(screen.getByText('confirmation-dialog-accept')).toBeInTheDocument()
            expect(screen.getByText('confirmation-dialog-reject')).toBeInTheDocument()
        })

        it('renders custom button texts when provided', () => {
            renderWithStore(
                <ConfirmationDialog
                    open
                    acceptText={'Yes, delete'}
                    rejectText={'Cancel'}
                />
            )
            expect(screen.getByText('Yes, delete')).toBeInTheDocument()
            expect(screen.getByText('Cancel')).toBeInTheDocument()
        })
    })

    describe('interaction', () => {
        it('calls onAccept when the accept button is clicked', () => {
            const onAccept = jest.fn()
            renderWithStore(
                <ConfirmationDialog
                    open
                    onAccept={onAccept}
                />
            )
            fireEvent.click(screen.getByText('confirmation-dialog-accept'))
            expect(onAccept).toHaveBeenCalledTimes(1)
        })

        it('calls onReject when the reject button is clicked', () => {
            const onReject = jest.fn()
            renderWithStore(
                <ConfirmationDialog
                    open
                    onReject={onReject}
                />
            )
            fireEvent.click(screen.getByText('confirmation-dialog-reject'))
            expect(onReject).toHaveBeenCalledTimes(1)
        })
    })
})
