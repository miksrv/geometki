import type { ApiType } from '@/api'

const VISIT_SHEET_EVENT = 'geometki:visit-sheet'

/**
 * A check-in on a phone, from any "Я здесь был(а)" of the place page (the bar or the "Где это"
 * card): the bar opens its sheet with the questions. The card is far below the bar's sheet, an
 * answer under its button went unseen.
 */
export const openVisitSheet = (visit: ApiType.Visits.CreateResponse): void => {
    window.dispatchEvent(new CustomEvent<ApiType.Visits.CreateResponse>(VISIT_SHEET_EVENT, { detail: visit }))
}

/** Listens for `openVisitSheet()`; returns the unsubscribe */
export const listenVisitSheet = (handler: (visit: ApiType.Visits.CreateResponse) => void): (() => void) => {
    const listener = (event: Event) => handler((event as CustomEvent<ApiType.Visits.CreateResponse>).detail)

    window.addEventListener(VISIT_SHEET_EVENT, listener)

    return () => window.removeEventListener(VISIT_SHEET_EVENT, listener)
}
