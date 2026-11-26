import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { AdminTable, AdminTableColumn } from './AdminTable'

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>
}))

jest.mock('../empty-state', () => ({
    EmptyState: ({ title, action }: { title: string; action?: React.ReactNode }) => (
        <div data-testid={'empty'}>
            {title}
            {action}
        </div>
    )
}))

// A table that renders what the wrapper hands it, so that the mapping is what is tested
jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' '),
    Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Table: ({ data, columns, loading }: any) =>
        loading ? (
            <div data-testid={'loading'} />
        ) : (
            <table>
                <thead>
                    <tr>
                        {columns.map((column: any) => (
                            <th
                                key={column.accessor}
                                onClick={() => column.onChangeSort?.({ key: column.accessor })}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row: any, index: number) => (
                        <tr key={row.id}>
                            {columns.map((column: any) => (
                                <td key={column.accessor}>{column.formatter(row[column.accessor], data, index)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        )
}))

interface Row {
    id: string
    name: string
}

const columns: Array<AdminTableColumn<Row>> = [
    { header: 'Name', key: 'name', render: (row) => <b>{row.name.toUpperCase()}</b>, sortable: true },
    { header: 'Id', key: 'id', render: (row) => row.id }
]

describe('AdminTable', () => {
    it('renders each cell with render(row)', () => {
        render(
            <AdminTable<Row>
                rows={[
                    { id: '1', name: 'one' },
                    { id: '2', name: 'two' }
                ]}
                columns={columns}
                emptyTitle={'Nothing'}
            />
        )

        expect(screen.getByText('ONE')).toBeInTheDocument()
        expect(screen.getByText('TWO')).toBeInTheDocument()
        expect(screen.queryByTestId('empty')).not.toBeInTheDocument()
    })

    it('shows the empty state with its action when there are no rows', () => {
        render(
            <AdminTable<Row>
                rows={[]}
                columns={columns}
                emptyTitle={'Nothing'}
                emptyAction={<button>Create</button>}
            />
        )

        expect(screen.getByTestId('empty')).toHaveTextContent('Nothing')
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    })

    it('keeps the table while loading, not the empty state', () => {
        render(
            <AdminTable<Row>
                columns={columns}
                loading={true}
                emptyTitle={'Nothing'}
            />
        )

        expect(screen.getByTestId('loading')).toBeInTheDocument()
        expect(screen.queryByTestId('empty')).not.toBeInTheDocument()
    })

    it('reports a click on a sortable header by its key, and only there', () => {
        const onSort = jest.fn()

        render(
            <AdminTable<Row>
                rows={[{ id: '1', name: 'one' }]}
                columns={columns}
                emptyTitle={'Nothing'}
                onSort={onSort}
            />
        )

        fireEvent.click(screen.getByText('Id'))
        expect(onSort).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('Name'))
        expect(onSort).toHaveBeenCalledWith('name')
    })
})
