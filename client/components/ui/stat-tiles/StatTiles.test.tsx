import React from 'react'

import { render, screen } from '@testing-library/react'

import { StatTiles } from './StatTiles'

describe('StatTiles', () => {
    it('is plain information without links', () => {
        render(
            <StatTiles
                aria-label={'season'}
                items={[
                    { key: 'place', label: 'place', value: '9' },
                    { key: 'players', label: 'players', value: '10' }
                ]}
            />
        )

        expect(screen.getByRole('group', { name: 'season' })).toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByText('9')).toBeInTheDocument()
        expect(screen.getByText('players')).toBeInTheDocument()
    })

    it('is a navigation when its tiles lead somewhere, and names a tile for screen readers', () => {
        render(
            <StatTiles
                aria-label={'counters'}
                items={[
                    { href: '/users/u1/places', key: 'places', label: 'places', value: '3' },
                    {
                        ariaLabel: 'reputation: 12',
                        href: '/users/u1/reputation',
                        key: 'reputation',
                        label: 'reputation',
                        tone: 'positive',
                        value: '+12'
                    }
                ]}
            />
        )

        expect(screen.getByRole('navigation', { name: 'counters' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'reputation: 12' })).toHaveAttribute('href', '/users/u1/reputation')
        expect(screen.getByText('+12')).toHaveClass('positive')
    })
})
