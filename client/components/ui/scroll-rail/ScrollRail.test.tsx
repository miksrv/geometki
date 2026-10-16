import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ScrollRail, ScrollRailSeparator } from './ScrollRail'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

const setSizes = (element: HTMLElement, { client, scroll, left }: { client: number; scroll: number; left: number }) => {
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: client })
    Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scroll })
    element.scrollLeft = left
}

describe('ScrollRail', () => {
    it('renders the items in a named group without arrows when everything fits', () => {
        render(
            <ScrollRail aria-label={'Категории'}>
                <button>Все</button>
                <ScrollRailSeparator />
                <button>Пещеры</button>
            </ScrollRail>
        )

        expect(screen.getByRole('group', { name: 'Категории' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    })

    it('shows the arrow towards the hidden items on scroll', () => {
        render(
            <ScrollRail aria-label={'Категории'}>
                <button>Все</button>
            </ScrollRail>
        )

        const list = screen.getByRole('group')

        setSizes(list, { client: 300, left: 0, scroll: 900 })
        fireEvent.scroll(list)
        expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

        setSizes(list, { client: 300, left: 600, scroll: 900 })
        fireEvent.scroll(list)
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    })
})

describe('ScrollRail cards', () => {
    it('turns a whole screen of cards per arrow press', () => {
        render(
            <ScrollRail
                variant={'cards'}
                aria-label={'Рядом'}
            >
                <article>1</article>
                <article>2</article>
            </ScrollRail>
        )

        const list = screen.getByRole('group', { name: 'Рядом' })
        const scrollBy = jest.fn()
        list.scrollBy = scrollBy

        setSizes(list, { client: 900, left: 0, scroll: 2700 })
        fireEvent.scroll(list)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        expect(scrollBy).toHaveBeenCalledWith({ behavior: 'smooth', left: 900 })
    })
})
