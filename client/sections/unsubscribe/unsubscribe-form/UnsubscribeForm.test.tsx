import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'

import { UnsubscribeForm } from './UnsubscribeForm'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, link, onClick, disabled }: any) =>
        link ? (
            <a href={link}>{label}</a>
        ) : (
            <button
                type={'button'}
                disabled={disabled}
                onClick={onClick}
            >
                {label}
            </button>
        ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Container: ({ children }: any) => <div>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Message: ({ type, title, children }: any) => (
        <div data-testid={`message-${String(type)}`}>
            {title}
            {children}
        </div>
    ),
    Spinner: () => <div data-testid={'spinner'} />
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts?.scope ? `${key}:${opts.scope as string}` : key)
    })
}))

const mockRouter = { isReady: true, push: jest.fn(), query: {} as Record<string, string> }
const mockReset = jest.fn()

jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/utils/api', () => ({ getErrorMessage: () => 'server error' }))

jest.mock('@/api', () => ({
    API: {
        useMailGetUnsubscribeQuery: jest.fn(),
        useMailPostUnsubscribeMutation: jest.fn()
    }
}))

const useStatus = jest.mocked(API.useMailGetUnsubscribeQuery)
const useUnsubscribe = jest.mocked(API.useMailPostUnsubscribeMutation)
const mockUnsubscribe = jest.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStatus = (value: any) => useStatus.mockReturnValue(value)
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockResult = (value: any = {}) =>
    useUnsubscribe.mockReturnValue([mockUnsubscribe, { reset: mockReset, ...value }] as any)
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('UnsubscribeForm', () => {
    beforeEach(() => {
        mockRouter.query = { token: 'u1.comment.sig' }
        mockRouter.isReady = true
        mockRouter.push.mockReset()
        mockUnsubscribe.mockReset()
        mockResult()
    })

    it('only reads the link on open and asks to confirm', () => {
        mockStatus({ data: { scope: 'comment', subscribed: true, token: 'u1.comment.sig' } })

        render(<UnsubscribeForm />)

        expect(useStatus).toHaveBeenCalledWith({ mail: undefined, token: 'u1.comment.sig' }, { skip: false })
        expect(mockUnsubscribe).not.toHaveBeenCalled()
        expect(screen.getByText('unsubscribe-question:unsubscribe-scope_comment')).toBeInTheDocument()
    })

    it('unsubscribes from the link scope', () => {
        mockStatus({ data: { scope: 'comment', subscribed: true, token: 'u1.comment.sig' } })

        render(<UnsubscribeForm />)
        fireEvent.click(screen.getByText('unsubscribe-button'))

        expect(mockUnsubscribe).toHaveBeenCalledWith({ scope: undefined, token: 'u1.comment.sig' })
    })

    it('unsubscribes from all emails', () => {
        mockStatus({ data: { scope: 'activity', subscribed: true, token: 'u1.activity.sig' } })

        render(<UnsubscribeForm />)
        fireEvent.click(screen.getByText('unsubscribe-all-button'))

        expect(mockUnsubscribe).toHaveBeenCalledWith({ scope: 'all', token: 'u1.activity.sig' })
    })

    it('uses the token from the server for a legacy mail-id link', () => {
        mockRouter.query = { mail: 'ff6f2ef33d3d1' }
        mockStatus({ data: { scope: 'cover', subscribed: true, token: 'u1.cover.sig' } })

        render(<UnsubscribeForm />)
        fireEvent.click(screen.getByText('unsubscribe-button'))

        expect(useStatus).toHaveBeenCalledWith({ mail: 'ff6f2ef33d3d1', token: undefined }, { skip: false })
        expect(mockUnsubscribe).toHaveBeenCalledWith({ scope: undefined, token: 'u1.cover.sig' })
    })

    it('says so when already unsubscribed, without buttons', () => {
        mockStatus({ data: { scope: 'digest', subscribed: false, token: 't' } })

        render(<UnsubscribeForm />)

        expect(screen.getByTestId('message-info')).toHaveTextContent('unsubscribe-already:unsubscribe-scope_digest')
        expect(screen.queryByText('unsubscribe-button')).not.toBeInTheDocument()
        expect(screen.getByText('unsubscribe-settings-link')).toHaveAttribute('href', '/users/settings')
    })

    it('shows the result after unsubscribing from all', () => {
        mockStatus({ data: { scope: 'comment', subscribed: true, token: 't' } })
        mockResult({ data: { scope: 'all', subscribed: false } })

        render(<UnsubscribeForm />)

        expect(screen.getByTestId('message-success')).toHaveTextContent('unsubscribe-done-all')
        expect(screen.queryByText('unsubscribe-button')).not.toBeInTheDocument()
    })

    it('shows the server error of an invalid link', () => {
        mockStatus({ error: { status: 400 } })

        render(<UnsubscribeForm />)

        expect(screen.getByTestId('message-error')).toHaveTextContent('server error')
    })

    it('goes home when the link has no token', () => {
        mockRouter.query = {}
        mockStatus({})

        render(<UnsubscribeForm />)

        expect(useStatus).toHaveBeenCalledWith({ mail: undefined, token: undefined }, { skip: true })
        expect(mockRouter.push).toHaveBeenCalledWith('/')
    })

    it('waits for the router before going home', () => {
        mockRouter.query = {}
        mockRouter.isReady = false
        mockStatus({})

        render(<UnsubscribeForm />)

        expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('shows a spinner and no buttons while the link is being read', () => {
        mockStatus({ isLoading: true })

        render(<UnsubscribeForm />)

        expect(screen.getByTestId('spinner')).toBeInTheDocument()
        expect(screen.queryByText('unsubscribe-button')).not.toBeInTheDocument()
    })

    it('disables the buttons while unsubscribing and shows a failed request', () => {
        mockStatus({ data: { scope: 'comment', subscribed: true, token: 't' } })
        mockResult({ error: { status: 500 }, isLoading: true })

        render(<UnsubscribeForm />)

        expect(screen.getByText('unsubscribe-button')).toBeDisabled()
        expect(screen.getByText('unsubscribe-all-button')).toBeDisabled()
        expect(screen.getByTestId('message-error')).toHaveTextContent('server error')
    })
})
