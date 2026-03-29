import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ImageUploader } from './ImageUploader'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

describe('ImageUploader', () => {
    describe('rendering', () => {
        it('renders a button element', () => {
            render(<ImageUploader />)
            expect(screen.getByRole('button')).toBeInTheDocument()
        })

        it('renders the upload text', () => {
            render(<ImageUploader />)
            expect(screen.getByText('click-here-upload-photos')).toBeInTheDocument()
        })

        it('renders the supported formats hint', () => {
            render(<ImageUploader />)
            expect(screen.getByText(/JPG, JPEG, PNG/)).toBeInTheDocument()
        })
    })

    describe('disabled prop', () => {
        it('applies disabled class when disabled is true', () => {
            render(<ImageUploader disabled />)
            expect(screen.getByRole('button')).toHaveClass('disabled')
        })

        it('does not apply disabled class when disabled is false', () => {
            render(<ImageUploader disabled={false} />)
            expect(screen.getByRole('button')).not.toHaveClass('disabled')
        })
    })

    describe('interaction', () => {
        it('calls onClick when button is clicked', () => {
            const onClick = jest.fn()
            render(<ImageUploader onClick={onClick} />)
            fireEvent.click(screen.getByRole('button'))
            expect(onClick).toHaveBeenCalledTimes(1)
        })

        it('does not throw when onClick is undefined and button is clicked', () => {
            render(<ImageUploader />)
            expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
        })
    })
})
