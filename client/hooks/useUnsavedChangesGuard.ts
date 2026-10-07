import { useCallback, useEffect, useRef, useState } from 'react'

import Router, { NextRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

type Resume = () => void

interface GuardEntry {
    isDirty: () => boolean
    block: (resume: Resume) => void
}

// One set of global listeners serves every mounted guard: `Router.beforePopState` has a single
// slot, and a page can hold several forms at once (e.g. a page in edit mode plus a dialog).
const guards: GuardEntry[] = []
let installed = false
// Set right before a navigation the user confirmed (or the app started after a save)
let bypass = false
// History entry of the current page, restored when the browser's Back/Forward is blocked
let currentEntry: { state: unknown; href: string } | null = null

const activeGuard = (): GuardEntry | undefined => (bypass ? undefined : [...guards].reverse().find((g) => g.isDirty()))

const rememberEntry = () => {
    currentEntry = { href: window.location.href, state: window.history.state }
}

const install = () => {
    // No router when `next/router` is mocked away (component tests)
    const router = (Router as unknown as { router?: NextRouter | null })?.router

    if (installed || typeof window === 'undefined' || !router || !Router.events) {
        return
    }

    installed = true
    rememberEntry()

    // Links, `useRouter()` and the `Router` singleton all call these methods on the router
    // instance at call time, so wrapping them catches every client-side navigation. (Throwing
    // from `routeChangeStart` would abort it too, but surfaces as an unhandled error.)
    const wrap = (method: 'push' | 'replace') => {
        const original = router[method].bind(router)

        router[method] = (url, as, options) => {
            const guard = options?.shallow ? undefined : activeGuard()

            if (!guard) {
                return original(url, as, options)
            }

            guard.block(() => {
                bypass = true
                void original(url, as, options).finally(() => {
                    bypass = false
                })
            })

            return Promise.resolve(false)
        }
    }

    wrap('push')
    wrap('replace')

    Router.events.on('routeChangeComplete', () => {
        bypass = false
        rememberEntry()
    })

    Router.events.on('routeChangeError', () => {
        bypass = false
    })

    // Back / Forward: the browser has already moved to the other entry, so the current page's
    // entry is pushed back to keep the address bar in sync. Going back once from it lands on
    // the entry the user was heading to, whichever button they pressed.
    router.beforePopState(() => {
        const guard = activeGuard()

        if (!guard) {
            return true
        }

        if (currentEntry) {
            window.history.pushState(currentEntry.state, '', currentEntry.href)
        }

        guard.block(() => {
            bypass = true
            window.history.back()
        })

        return false
    })

    window.addEventListener('beforeunload', (event) => {
        if (activeGuard()) {
            event.preventDefault()
            event.returnValue = ''
        }
    })
}

/**
 * Protects unsaved form changes. While `isDirty` is true, leaving the page by a link, the
 * browser's Back/Forward or a programmatic `router.push` opens the confirmation dialog, and
 * closing or reloading the tab triggers the browser's native prompt.
 *
 * Render `<ConfirmationDialog {...dialogProps} />` next to the form. Wrap in-page discards
 * (Cancel buttons, closing a dialog) with `confirmDiscard`, and call `allowNavigation()`
 * right before navigating away after a successful save.
 */
export const useUnsavedChangesGuard = (isDirty: boolean) => {
    const { t } = useTranslation()

    // What runs on confirm; `discard` is an in-page action (Cancel, closing a dialog), not leaving
    // (kept after closing so the dialog's text doesn't flip during its close animation)
    const [pending, setPending] = useState<{ resume: Resume; discard?: boolean; open: boolean } | null>(null)

    const dirtyRef = useRef(isDirty)
    dirtyRef.current = isDirty

    useEffect(() => {
        install()

        const entry: GuardEntry = {
            block: (resume) => setPending({ open: true, resume }),
            isDirty: () => dirtyRef.current
        }

        guards.push(entry)

        return () => {
            guards.splice(guards.indexOf(entry), 1)
        }
    }, [])

    const confirmDiscard = useCallback((discard: () => void) => {
        if (dirtyRef.current) {
            setPending({ discard: true, open: true, resume: discard })
        } else {
            discard()
        }
    }, [])

    const allowNavigation = useCallback(() => {
        bypass = true
    }, [])

    const handleConfirm = useCallback(() => {
        setPending((prev) => (prev ? { ...prev, open: false } : prev))
        pending?.resume()
    }, [pending])

    const handleCancel = useCallback(() => setPending((prev) => (prev ? { ...prev, open: false } : prev)), [])

    return {
        allowNavigation,
        confirmDiscard,
        dialogProps: {
            confirmLabel: pending?.discard
                ? t('discard-changes', { defaultValue: 'Не сохранять' })
                : t('leave-without-saving'),
            message: pending?.discard
                ? t('unsaved-changes-discard-message', {
                      defaultValue: 'У вас есть несохранённые изменения. Закрыть без сохранения?'
                  })
                : t('unsaved-changes-message'),
            onCancel: handleCancel,
            onConfirm: handleConfirm,
            open: !!pending?.open
        }
    }
}
