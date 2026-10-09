import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { PlacesLandingDescription } from './PlacesLandingDescription'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' '),
    Container: ({ children, className }: any) => <div className={className}>{children}</div>
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValueOrOptions?: string | Record<string, unknown>) =>
            (typeof defaultValueOrOptions === 'string' ? defaultValueOrOptions : defaultValueOrOptions?.defaultValue) ??
            key
    })
}))

describe('PlacesLandingDescription', () => {
    it('renders nothing for an empty description', () => {
        const { container } = render(<PlacesLandingDescription text={''} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders the text and a "Подробнее" toggle', () => {
        render(<PlacesLandingDescription text={'132 места в Башкортостане'} />)

        expect(screen.getByText('132 места в Башкортостане')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Подробнее' })).toBeInTheDocument()
    })

    it('hides the toggle once expanded, and keeps the text visible', () => {
        render(<PlacesLandingDescription text={'132 места в Башкортостане'} />)

        fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))

        expect(screen.queryByRole('button', { name: 'Подробнее' })).not.toBeInTheDocument()
        expect(screen.getByText('132 места в Башкортостане')).toBeInTheDocument()
    })

    it('adds the expanded class (lifts the mobile line-clamp) only after the toggle is clicked', () => {
        render(<PlacesLandingDescription text={'132 места в Башкортостане'} />)

        const text = screen.getByText('132 места в Башкортостане')
        expect(text.className).not.toContain('expanded')

        fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))

        expect(text.className).toContain('expanded')
    })
})
