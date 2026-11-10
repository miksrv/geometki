import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import * as LocalStorage from '@/utils/localstorage'

import { CookieNotice } from './CookieNotice'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick }: any) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(() => ''), setItem: jest.fn() }))

describe('CookieNotice', () => {
    beforeEach(() => {
        jest.mocked(LocalStorage.getItem).mockReturnValue('')
        jest.mocked(LocalStorage.setItem).mockClear()
    })

    it('tells a new visitor about cookies', () => {
        render(<CookieNotice />)

        expect(screen.getByRole('region', { name: 'cookie-notice-label' })).toHaveTextContent('cookie-notice-text')
    })

    it('is gone for good once closed', () => {
        render(<CookieNotice />)

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'cookie-notice-accept' }))
        })

        expect(screen.queryByRole('region')).not.toBeInTheDocument()
        expect(LocalStorage.setItem).toHaveBeenCalledWith('cookieConsent', expect.any(String))
    })

    it('is not shown to a visitor who closed it before', () => {
        jest.mocked(LocalStorage.getItem).mockReturnValue('1731200000000')
        render(<CookieNotice />)

        expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('does not close on Escape: the visitor closes it', () => {
        render(<CookieNotice />)

        fireEvent.keyDown(window, { key: 'Escape' })

        expect(screen.getByRole('region')).toBeInTheDocument()
    })
})
