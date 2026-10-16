import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PlaceCover } from './PlaceCover'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick }: any) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-icon={name} />,
    Skeleton: () => <div data-testid={'skeleton'} />
}))

jest.mock('next/image', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Image = ({ src, alt, onLoad }: any) => (
        // eslint-disable-next-line next/no-img-element
        <img
            src={src}
            alt={alt}
            onLoad={onLoad}
        />
    )
    return Image
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key })
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

const place = {
    id: 'p1',
    title: 'Ущелье',
    cover: { full: 'cover.jpg', preview: 'cover_preview.jpg' }
} as ApiModel.Place

describe('PlaceCover', () => {
    it('shows a skeleton under the cover until it has loaded', () => {
        render(
            <PlaceCover
                place={place}
                coverHash={1}
            />
        )

        expect(screen.getByTestId('skeleton')).toBeInTheDocument()

        fireEvent.load(screen.getByAltText('Ущелье'))

        expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
    })

    it('opens the first photo from the cover', () => {
        const onPhotoClick = jest.fn()
        const photos = [{ id: 'a', full: 'a.jpg', preview: 'a_p.jpg', title: 'Ущелье', width: 4, height: 3 }]

        render(
            <PlaceCover
                place={place}
                photos={photos as ApiModel.Photo[]}
                coverHash={1}
                onPhotoClick={onPhotoClick}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Ущелье' }))

        expect(onPhotoClick).toHaveBeenCalledWith(0)
    })
})
