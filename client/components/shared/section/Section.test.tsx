import React from 'react'

import { render, screen } from '@testing-library/react'

import { Section } from './Section'

describe('Section', () => {
    it('renders an h2 heading the section is labelled by', () => {
        render(<Section title={'Фото (17)'}>content</Section>)

        const heading = screen.getByRole('heading', { level: 2, name: 'Фото (17)' })
        const section = screen.getByRole('region', { name: 'Фото (17)' })

        expect(section).toHaveAttribute('aria-labelledby', heading.id)
        expect(section).toHaveTextContent('content')
    })

    it('renders an h3 for level 3 (sidebar blocks)', () => {
        render(
            <Section
                title={'В коллекциях'}
                level={3}
            />
        )

        expect(screen.getByRole('heading', { level: 3, name: 'В коллекциях' })).toBeInTheDocument()
    })

    it('renders the action next to the heading and the footer under the content', () => {
        render(
            <Section
                title={'Описание'}
                action={<button>Изменить</button>}
                footer={'footer text'}
            >
                body
            </Section>
        )

        expect(screen.getByRole('button', { name: 'Изменить' })).toBeInTheDocument()
        expect(screen.getByText('footer text')).toBeInTheDocument()
    })

    it('renders no header without a title or an action', () => {
        const { container } = render(<Section>only body</Section>)

        expect(container.querySelector('h2')).toBeNull()
        expect(screen.getByText('only body')).toBeInTheDocument()
    })
})
