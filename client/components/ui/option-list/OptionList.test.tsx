import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { OptionList } from './OptionList'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

describe('OptionList', () => {
    it('renders groups with labels and marks the chosen row', () => {
        render(
            <OptionList
                groups={[
                    {
                        items: [
                            { key: 'a', label: 'Оренбургская область', selected: true },
                            { caption: '12 мест', key: 'b', label: 'Башкортостан' }
                        ],
                        label: 'Недавние'
                    }
                ]}
            />
        )

        expect(screen.getByRole('group', { name: 'Недавние' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Оренбургская/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: /Башкортостан/ })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByText('12 мест')).toBeInTheDocument()
    })

    it('reports the picked key', () => {
        const onSelect = jest.fn()
        render(
            <OptionList
                groups={[{ items: [{ key: 'rating', label: 'Лучший рейтинг' }] }]}
                onSelect={onSelect}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Лучший рейтинг/ }))
        expect(onSelect).toHaveBeenCalledWith('rating')
    })

    it('drops empty groups and shows the empty text when nothing is left', () => {
        render(
            <OptionList
                groups={[{ items: [], label: 'Регионы' }]}
                emptyText={'Ничего не найдено'}
            />
        )

        expect(screen.queryByText('Регионы')).not.toBeInTheDocument()
        expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    })
})
