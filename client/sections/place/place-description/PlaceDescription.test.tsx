import React from 'react'

import { render } from '@testing-library/react'

import { PlaceDescription } from './PlaceDescription'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ children, onClick }: any) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {children}
        </button>
    ),
    Icon: () => null,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))

jest.mock('@/app/store', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: () => false
}))

jest.mock('@/app/applicationSlice', () => ({ openAuthDialog: jest.fn() }))

jest.mock('@/components/shared', () => ({
    Section: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>
}))

const setScrollHeight = (height: number) =>
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => height })

describe('PlaceDescription', () => {
    beforeEach(() => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as never
    })

    it('leaves no reserved row under a medium text that fits', () => {
        setScrollHeight(300)
        const content = 'а'.repeat(600)
        const { container } = render(
            <PlaceDescription
                content={content}
                contentHtml={`<p>${content}</p>`}
            />
        )

        expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
        expect(container.querySelector('button')).toBeNull()
    })

    it('offers to read the whole of a text taller than the clamp', () => {
        setScrollHeight(900)
        const content = 'а'.repeat(600)
        const { getByRole } = render(
            <PlaceDescription
                content={content}
                contentHtml={`<p>${content}</p>`}
            />
        )

        expect(getByRole('button', { name: /read-full-text/ })).toBeInTheDocument()
    })
})
