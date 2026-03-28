/**
 * Manual Jest mock for `simple-react-ui-kit`.
 *
 * The package ships as pure ESM which babel-jest cannot transform.
 * This file provides CJS-compatible stubs of all exports used in the project.
 */
import React from 'react'

export const cn = (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' ')

export const Icon = ({ name }: { name: string }) => (
    <span
        data-testid={`icon-${name}`}
        aria-label={name}
    />
)

export const Button = ({ label, icon, onClick, disabled, loading, mode, variant, className, children }: any) => (
    <button
        className={className}
        disabled={disabled || loading}
        data-mode={mode}
        data-variant={variant}
        data-icon={icon}
        onClick={onClick}
    >
        {label ?? children}
    </button>
)

export const Spinner = ({ className }: { className?: string }) => (
    <div
        className={className}
        data-testid={'spinner'}
    />
)

export const Container = ({ header, children, className }: any) => (
    <div className={className}>
        {header && <div data-testid={'container-header'}>{header}</div>}
        {children}
    </div>
)

export const Dialog = ({ open, header, children, onCloseDialog, maxWidth }: any) =>
    open ? (
        <div
            role={'dialog'}
            data-testid={'simple-dialog'}
            style={{ maxWidth }}
        >
            {header && <h2>{header}</h2>}
            {children}
            <button
                onClick={onCloseDialog}
                aria-label={'close'}
            />
        </div>
    ) : null

// Re-export types to avoid TypeScript errors in consuming files
export type ContainerProps = {
    className?: string
    header?: React.ReactNode
    children?: React.ReactNode
}

export type ButtonProps = {
    label?: string
    icon?: string
    onClick?: (e: React.MouseEvent) => void
    disabled?: boolean
    loading?: boolean
    mode?: string
    variant?: string
    className?: string
    children?: React.ReactNode
}

export type DialogProps = {
    open?: boolean
    header?: string
    maxWidth?: string
    children?: React.ReactNode
    onCloseDialog?: () => void
}

export type IconTypes = string
