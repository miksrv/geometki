/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from 'next'

import handler from '@/pages/api/revalidate'

jest.mock('@/next-i18next.config', () => ({ i18n: { defaultLocale: 'ru', locales: ['ru', 'en'] } }))

const call = async (method: string, body: unknown, secret?: string) => {
    const res = {
        json: jest.fn(),
        revalidate: jest.fn().mockResolvedValue(undefined),
        setHeader: jest.fn(),
        status: jest.fn()
    }
    res.status.mockReturnValue(res)

    await handler(
        { body, headers: secret ? { 'x-revalidate-secret': secret } : {}, method } as unknown as NextApiRequest,
        res as unknown as NextApiResponse
    )

    return res
}

describe('POST /api/revalidate', () => {
    beforeEach(() => {
        process.env.REVALIDATE_SECRET = 's3cret'
    })

    afterEach(() => {
        delete process.env.REVALIDATE_SECRET
    })

    it('renders each place path in every locale and answers first', async () => {
        const res = await call('POST', { paths: ['/places/abc0123456789-monument'] }, 's3cret')

        expect(res.status).toHaveBeenCalledWith(202)
        expect(res.revalidate.mock.calls).toEqual([
            ['/places/abc0123456789-monument'],
            ['/en/places/abc0123456789-monument']
        ])
    })

    it('refuses a wrong secret, and any secret when none is set', async () => {
        expect((await call('POST', { paths: ['/places/abc'] }, 'guess')).status).toHaveBeenCalledWith(401)

        delete process.env.REVALIDATE_SECRET
        expect((await call('POST', { paths: ['/places/abc'] }, '')).status).toHaveBeenCalledWith(401)
    })

    it('renders only place pages, at most 50 paths', async () => {
        const res = await call('POST', { paths: ['/', '/users/1', '/places/a/../../x'] }, 's3cret')
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.revalidate).not.toHaveBeenCalled()

        const many = Array.from({ length: 51 }, (_, i) => `/places/p${i}`)
        expect((await call('POST', { paths: many }, 's3cret')).status).toHaveBeenCalledWith(400)
    })

    it('answers 405 to anything but POST', async () => {
        expect((await call('GET', undefined, 's3cret')).status).toHaveBeenCalledWith(405)
    })
})
