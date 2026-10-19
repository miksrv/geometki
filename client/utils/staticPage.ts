import { PHASE_PRODUCTION_BUILD } from 'next/constants'

/**
 * The revalidate of a cached page that was rendered without the API's answer: thrown at run
 * time (Next keeps serving the page rendered before), and during the build — where a page
 * without a dynamic segment is rendered — kept for a few seconds only, so a deploy does not
 * fail when the API is away and the first visitors get a full page.
 */
export const staticRevalidate = (failed: boolean, revalidate: number): number => {
    if (!failed) {
        return revalidate
    }

    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
        return 10
    }

    throw new Error('The API did not answer: the page is kept as it was')
}
