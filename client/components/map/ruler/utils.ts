/**
 * Whether a key press is meant for a measuring tool (Esc, Backspace). Keys typed in a field,
 * pressed with a modifier, or already handled elsewhere (a popup, a menu, a dialog) are not:
 * only the page itself or the map count.
 */
export const isMeasureToolKey = (event: KeyboardEvent, mapContainer: HTMLElement): boolean => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
        return false
    }

    const target = event.target

    if (!(target instanceof HTMLElement)) {
        return true
    }

    if (target.isContentEditable || target.closest('input, textarea, select')) {
        return false
    }

    return target === document.body || mapContainer.contains(target)
}

/** Touch screens have no cursor: the cursor-following line would stick to the last tap */
export const hasNoHover = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches
