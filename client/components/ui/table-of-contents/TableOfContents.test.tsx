import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { TableOfContents } from './TableOfContents'

const items = [
    { id: 'first', title: 'С чего всё началось' },
    { id: 'second', title: 'Игра' }
]

describe('TableOfContents', () => {
    beforeEach(() => {
        document.body.innerHTML = '<h2 id="first">С чего всё началось</h2><h2 id="second">Игра</h2>'
        Element.prototype.scrollIntoView = jest.fn()
        // The second section is still below the line under the app bar
        jest.spyOn(document.getElementById('second')!, 'getBoundingClientRect').mockReturnValue({
            top: 500
        } as DOMRect)
    })

    it('lists the sections as anchors, the first one current', () => {
        render(
            <TableOfContents
                items={items}
                label={'Содержание'}
            />
        )

        expect(screen.getByRole('navigation', { name: 'Содержание' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Игра' })).toHaveAttribute('href', '#second')
        expect(screen.getByRole('link', { name: 'С чего всё началось' })).toHaveAttribute('aria-current', 'location')
    })

    it('scrolls to a section on a click and marks it', () => {
        render(
            <TableOfContents
                items={items}
                label={'Содержание'}
            />
        )

        fireEvent.click(screen.getByRole('link', { name: 'Игра' }))

        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
        expect(screen.getByRole('link', { name: 'Игра' })).toHaveAttribute('aria-current', 'location')
        expect(window.location.hash).toBe('#second')
    })

    it('shows nothing for a single section', () => {
        const { container } = render(
            <TableOfContents
                items={items.slice(0, 1)}
                label={'Содержание'}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })
})
