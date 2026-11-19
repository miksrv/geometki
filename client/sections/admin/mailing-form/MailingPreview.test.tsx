import React from 'react'

import { act, render, screen } from '@testing-library/react'

import { MailingPreview } from './MailingPreview'

const mockTrigger = jest.fn()

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))

jest.mock('@/api', () => ({
    API: {
        useMailingsPostPreviewMutation: () => [mockTrigger]
    }
}))

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ children }: any) => <div>{children}</div>,
    Skeleton: () => <div data-testid={'skeleton'} />
}))

const values = { content: 'Текст', subject: 'Тема' }

describe('MailingPreview', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockTrigger.mockReset()
        mockTrigger.mockReturnValue({ unwrap: () => Promise.resolve({ html: '<p>letter</p>', subject: 'Тема' }) })
    })

    afterEach(() => jest.useRealTimers())

    it('draws the letter from the form and shows it in a frame without scripts', async () => {
        render(
            <MailingPreview
                values={values}
                mailingId={'m1'}
            />
        )

        await act(async () => {
            await Promise.resolve()
        })

        expect(mockTrigger).toHaveBeenCalledWith({ ...values, id: 'm1' })

        const frame = screen.getByTitle('admin-mailing-preview')
        expect(frame).toHaveAttribute('srcdoc', '<p>letter</p>')
        expect(frame).toHaveAttribute('sandbox', '')
        expect(screen.getByText('Тема')).toBeInTheDocument()
    })
})
