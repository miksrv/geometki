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
    Button: ({ children, onClick, variant, mode }: any) => (
        <button
            data-variant={variant}
            data-mode={mode}
            onClick={onClick}
        >
            {children}
        </button>
    ),
    Dialog: ({ open, children, onCloseDialog, contentClassName }: any) =>
        open ? (
            <div
                data-testid={'dialog'}
                data-content-class={contentClassName}
                onClick={(e) => e.target === e.currentTarget && onCloseDialog?.()}
            >
                {children}
            </div>
        ) : null
}))

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

const defaultProps = {
    open: true,
    message: 'Are you sure?',
    onConfirm: jest.fn(),
    onCancel: jest.fn()
}

describe('ConfirmationDialog', () => {
    describe('when closed', () => {
        it('renders nothing when open is false', () => {
            const { container } = renderWithStore(
                <ConfirmationDialog
                    {...defaultProps}
                    open={false}
                />
            )
            expect(container.firstChild).toBeNull()
        })
    })

    describe('when open', () => {
        it('renders the dialog element', () => {
            renderWithStore(<ConfirmationDialog {...defaultProps} />)
            expect(screen.getByTestId('dialog')).toBeInTheDocument()
        })

        it('renders the provided message', () => {
            renderWithStore(<ConfirmationDialog {...defaultProps} />)
            expect(screen.getByText('Are you sure?')).toBeInTheDocument()
        })

        it('renders cancel and delete buttons via translation keys', () => {
            renderWithStore(<ConfirmationDialog {...defaultProps} />)
            expect(screen.getByText('cancel')).toBeInTheDocument()
            expect(screen.getByText('delete')).toBeInTheDocument()
        })
    })

    describe('interaction', () => {
        it('calls onConfirm when the delete button is clicked', () => {
            const onConfirm = jest.fn()
            renderWithStore(
                <ConfirmationDialog
                    {...defaultProps}
                    onConfirm={onConfirm}
                />
            )
            fireEvent.click(screen.getByText('delete'))
            expect(onConfirm).toHaveBeenCalledTimes(1)
        })

        it('calls onCancel when the cancel button is clicked', () => {
            const onCancel = jest.fn()
            renderWithStore(
                <ConfirmationDialog
                    {...defaultProps}
                    onCancel={onCancel}
                />
            )
            fireEvent.click(screen.getByText('cancel'))
            expect(onCancel).toHaveBeenCalledTimes(1)
        })
    })
})
