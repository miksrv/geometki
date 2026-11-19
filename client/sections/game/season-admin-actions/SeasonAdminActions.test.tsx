import React from 'react'

import { screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'

import { SeasonAdminActions } from './SeasonAdminActions'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, link }: { label: string; link?: string }) => <a href={link}>{label}</a>,
    cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' ')
}))

const store = (role: string) => makeTestStore({ auth: { isAuth: true, user: { id: 'u1', name: 'Alice', role } } })

describe('SeasonAdminActions', () => {
    it('gives an administrator the edit and create buttons of the site', () => {
        renderWithStore(
            <SeasonAdminActions
                seasonId={'c61b27c8d8143'}
                create={true}
            />,
            { store: store('admin') }
        )

        expect(screen.getByRole('link', { name: 'edit' })).toHaveAttribute('href', '/game/seasons/c61b27c8d8143/edit')
        expect(screen.getByRole('link', { name: 'create' })).toHaveAttribute('href', '/game/seasons/create')
        // "Создать" comes first
        expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['create', 'edit'])
    })

    it('creates without a season: between seasons there is nothing to edit', () => {
        renderWithStore(<SeasonAdminActions create={true} />, { store: store('admin') })

        expect(screen.queryByRole('link', { name: 'edit' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'create' })).toBeInTheDocument()
    })

    it('shows nobody else the buttons, but keeps what stands on the left', () => {
        const { container, unmount } = renderWithStore(
            <SeasonAdminActions
                seasonId={'s'}
                create={true}
            />,
            { store: store('user') }
        )

        expect(container).toBeEmptyDOMElement()
        unmount()

        renderWithStore(
            <SeasonAdminActions seasonId={'s'}>
                <nav>{'crumbs'}</nav>
            </SeasonAdminActions>,
            { store: store('user') }
        )

        expect(screen.getByText('crumbs')).toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
})
