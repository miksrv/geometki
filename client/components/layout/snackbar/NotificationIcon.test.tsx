import React from 'react'

import { render, screen } from '@testing-library/react'

import { NotificationIcon } from './NotificationIcon'

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    useTooltip: () => ({ tooltip: null, triggerProps: {} })
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height }: any) => (
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/levels', () => ({
    levelColor: jest.fn().mockReturnValue('#aabbcc'),
    levelColors: jest.fn().mockReturnValue({ border: '#334455', fill: '#aabbcc' })
}))

describe('NotificationIcon', () => {
    describe('experience type', () => {
        it('renders DoubleUp icon for experience type', () => {
            render(
                <NotificationIcon
                    type={'experience'}
                    id={'n1'}
                    read={false}
                />
            )
            expect(screen.getByTestId('icon-DoubleUp')).toBeInTheDocument()
        })
    })

    describe('error type', () => {
        it('renders ReportError icon for error type', () => {
            render(
                <NotificationIcon
                    type={'error'}
                    id={'n1'}
                    read={false}
                />
            )
            expect(screen.getByTestId('icon-ReportError')).toBeInTheDocument()
        })
    })

    describe('success type', () => {
        it('renders CheckCircle icon for success type', () => {
            render(
                <NotificationIcon
                    type={'success'}
                    id={'n1'}
                    read={false}
                />
            )
            expect(screen.getByTestId('icon-CheckCircle')).toBeInTheDocument()
        })
    })

    describe('level type', () => {
        it('renders a level badge for level type', () => {
            render(
                <NotificationIcon
                    type={'level'}
                    id={'n1'}
                    read={false}
                    meta={{ level: 5, value: 0, title: 'Explorer' }}
                />
            )
            expect(screen.getByText('5')).toBeInTheDocument()
        })
    })

    describe('photo/place type with place cover', () => {
        it('renders the place cover image when place with cover is provided', () => {
            render(
                <NotificationIcon
                    type={'photo'}
                    id={'n1'}
                    read={false}
                    place={{ id: 'p1', title: 'Test Place', cover: { preview: '/photos/preview.jpg' } as any }}
                />
            )
            const img = screen.getByRole('presentation')
            expect(img).toHaveAttribute('src', 'https://img.example.com/photos/preview.jpg')
        })
    })

    describe('achievements type without image', () => {
        it('renders Award icon when achievements type has no meta image', () => {
            render(
                <NotificationIcon
                    type={'achievements' as any}
                    id={'n1'}
                    read={false}
                />
            )
            expect(screen.getByTestId('icon-Award')).toBeInTheDocument()
        })
    })

    describe('type without icon', () => {
        it('renders nothing when no matching type and no place', () => {
            const { container } = render(
                <NotificationIcon
                    type={'unknown' as any}
                    id={'n1'}
                    read={false}
                />
            )
            expect(container.innerHTML).toBe('')
        })
    })
})
