import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'

import { PlaceCoverEditor } from './PlaceCoverEditor'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, disabled, onClick }: any) => (
        <button
            type={'button'}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null)
}))

jest.mock('react-image-crop', () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: ({ children }: any) => <div>{children}</div>
}))

jest.mock('react-image-crop/src/ReactCrop.scss', () => ({}))

jest.mock('next/image', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Image = ({ src, onClick }: any) => (
        // eslint-disable-next-line next/no-img-element
        <img
            src={src}
            alt={''}
            onClick={onClick}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/app/store', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('@/app/applicationSlice', () => ({ toggleOverlay: () => ({ type: 'overlay' }) }))
jest.mock('@/app/notificationSlice', () => ({ Notify: () => ({ type: 'notify' }) }))
jest.mock('@/utils/api', () => ({ getErrorMessage: () => 'error' }))
jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

jest.mock('@/api', () => ({
    API: {
        usePhotosGetListQuery: jest.fn(),
        usePlacesPatchCoverMutation: jest.fn()
    }
}))

const external = (coverAllowed: boolean, id: string, preview: string) => ({
    external: { coverAllowed, externalId: id, source: 'pastvu', url: `https://pastvu.com/p/${id}` },
    full: preview.replace('/h/', '/a/'),
    height: 1000,
    id: `linked-${id}`,
    preview,
    width: 1600
})

const photos = [
    { full: 'uploads/own.jpg', height: 1200, id: 'own', preview: 'uploads/own_preview.jpg', width: 1800 },
    external(true, '1', 'https://img.pastvu.com/h/big.jpg'),
    external(false, '2', 'https://img.pastvu.com/h/small.jpg')
]

const mockUpdateCover = jest.fn()

describe('PlaceCoverEditor', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(API.usePhotosGetListQuery).mockReturnValue({ data: { items: photos }, isLoading: false } as never)
        jest.mocked(API.usePlacesPatchCoverMutation).mockReturnValue([
            mockUpdateCover,
            { isError: false, isLoading: false, isSuccess: false }
        ] as never)
    })

    it('offers the uploaded photos and the linked ones a cover can be cut from', () => {
        const { container } = render(
            <PlaceCoverEditor
                placeId={'place'}
                open={true}
            />
        )

        const sources = Array.from(container.querySelectorAll('li img')).map((img) => img.getAttribute('src'))

        expect(sources).toStrictEqual(['https://img.test/uploads/own_preview.jpg', 'https://img.pastvu.com/h/big.jpg'])
        expect(screen.getByText('PastVu')).toBeInTheDocument()
    })

    it('cuts the cover from a linked photo by the size of the loaded file', () => {
        const { container } = render(
            <PlaceCoverEditor
                placeId={'place'}
                open={true}
            />
        )

        fireEvent.click(container.querySelectorAll('li img')[1])

        // The PastVu file is taller than in the API (1600×1000): its signature strip
        const image = container.querySelector('img[src="https://img.pastvu.com/a/big.jpg"]') as HTMLImageElement
        Object.defineProperties(image, {
            height: { value: 410 },
            naturalHeight: { value: 1025 },
            naturalWidth: { value: 1600 },
            width: { value: 640 }
        })
        fireEvent.load(image)

        fireEvent.click(screen.getByText('save'))

        expect(mockUpdateCover).toHaveBeenCalledWith({
            externalPhotoId: 'linked-1',
            height: 533,
            placeId: 'place',
            width: 1600,
            x: 0,
            y: 0
        })
    })
})
