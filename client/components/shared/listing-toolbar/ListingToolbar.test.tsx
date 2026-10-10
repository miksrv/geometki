import React from 'react'

import { render, screen } from '@testing-library/react'

import { ListingToolbar, ListingToolbarGroup } from './ListingToolbar'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' ')
}))

describe('ListingToolbar', () => {
    it('renders a toolbar with its groups and controls', () => {
        render(
            <ListingToolbar>
                <ListingToolbarGroup>
                    <div>location</div>
                    <div>category</div>
                </ListingToolbarGroup>
                <ListingToolbarGroup>
                    <div>sort</div>
                </ListingToolbarGroup>
            </ListingToolbar>
        )

        const toolbar = screen.getByRole('toolbar')
        expect(toolbar.children).toHaveLength(2)
        expect(toolbar.children[0].className).toContain('group')
        expect(screen.getByText('sort')).toBeInTheDocument()
    })
})
