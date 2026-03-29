import React from 'react'

import { render, screen } from '@testing-library/react'

import { Carousel } from './Carousel'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

jest.mock('embla-carousel-react', () => jest.fn().mockReturnValue([jest.fn(), undefined]))

describe('Carousel', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<Carousel />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders children inside the carousel container', () => {
            render(
                <Carousel>
                    <div data-testid={'slide-1'}>Slide 1</div>
                    <div data-testid={'slide-2'}>Slide 2</div>
                </Carousel>
            )
            expect(screen.getByTestId('slide-1')).toBeInTheDocument()
            expect(screen.getByTestId('slide-2')).toBeInTheDocument()
        })

        it('renders prev and next navigation buttons', () => {
            render(<Carousel />)
            const buttons = screen.getAllByRole('button')
            expect(buttons).toHaveLength(2)
        })

        it('renders KeyboardLeft and KeyboardRight icons in navigation buttons', () => {
            render(<Carousel />)
            expect(screen.getByTestId('icon-KeyboardLeft')).toBeInTheDocument()
            expect(screen.getByTestId('icon-KeyboardRight')).toBeInTheDocument()
        })

        it('both navigation buttons are initially disabled when emblaApi is undefined', () => {
            render(<Carousel />)
            const buttons = screen.getAllByRole('button')
            buttons.forEach((button) => expect(button).toBeDisabled())
        })
    })
})
