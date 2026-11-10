import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { FormSection, FormSections } from './FormSections'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Container: ({ id, title, children }: any) => (
        <section id={id}>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    Icon: () => null,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

const SECTIONS = [
    { icon: 'User' as const, key: 'one', title: 'Первый' },
    { icon: 'Bell' as const, key: 'two', title: 'Второй' }
]

const tops: Record<string, number> = {}

beforeEach(() => {
    tops.one = 64
    tops.two = 700
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        return { top: tops[this.id] ?? 0 } as DOMRect
    })
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0)
        return 0
    })
})

afterEach(() => jest.restoreAllMocks())

const renderForm = () =>
    render(
        <FormSections
            sections={SECTIONS}
            label={'Разделы'}
        >
            <FormSection
                id={'one'}
                title={'Первый'}
                description={'Что здесь'}
            />
            <FormSection
                id={'two'}
                title={'Второй'}
            />
        </FormSections>
    )

describe('FormSections', () => {
    it('lists the parts with the first one current, the cards with their lines', () => {
        renderForm()

        expect(screen.getByRole('navigation', { name: 'Разделы' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Первый' })).toHaveAttribute('aria-current', 'location')
        expect(screen.getByText('Что здесь')).toBeInTheDocument()
    })

    it('follows the scroll', () => {
        renderForm()

        tops.one = -500
        tops.two = 40
        act(() => {
            window.dispatchEvent(new Event('scroll'))
        })

        expect(screen.getByRole('link', { name: 'Второй' })).toHaveAttribute('aria-current', 'location')
    })

    it('scrolls to the card on a click and marks it at once', () => {
        const scrollIntoView = jest.fn()
        Element.prototype.scrollIntoView = scrollIntoView
        renderForm()

        fireEvent.click(screen.getByRole('link', { name: 'Второй' }))

        expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
        expect(screen.getByRole('link', { name: 'Второй' })).toHaveAttribute('aria-current', 'location')
    })
})
