import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { formatMailingDate, isMailingDraft, isMailingStatus, isMailingUrl, mailingProgress } from './mailings'

dayjs.extend(utc)

describe('mailings utils', () => {
    it('knows the statuses', () => {
        expect(isMailingStatus('draft')).toBe(true)
        expect(isMailingStatus('queued')).toBe(false)
        expect(isMailingStatus(undefined)).toBe(false)
    })

    it('says that only a draft is a draft', () => {
        expect(isMailingDraft({ status: 'draft' })).toBe(true)
        expect(isMailingDraft({ status: 'sending' })).toBe(false)
        expect(isMailingDraft(undefined)).toBe(false)
    })

    it('writes the UTC time of the API in local time', () => {
        expect(formatMailingDate('2026-11-15 11:05:00', 'YYYY')).toBe('2026')
        expect(formatMailingDate('2026-11-15 11:05:00')).toMatch(/^1[56]\.11\.2026, \d{2}:05$/)
        expect(formatMailingDate(null)).toBe('')
    })

    it('counts the progress of a sending', () => {
        expect(
            mailingProgress({ delivery: { failed: 1, pending: 6, rejected: 1, sent: 2 }, recipients: 10 })
        ).toStrictEqual({
            done: 4,
            percent: 40,
            recipients: 10
        })
        expect(
            mailingProgress({ delivery: { failed: 0, pending: 0, rejected: 0, sent: 0 }, recipients: 0 }).percent
        ).toBe(0)
    })

    it('accepts a site path or an http(s) address as a link', () => {
        expect(isMailingUrl('/game')).toBe(true)
        expect(isMailingUrl('https://geometki.com/en')).toBe(true)
        expect(isMailingUrl('javascript:alert(1)')).toBe(false)
        expect(isMailingUrl('geometki.com')).toBe(false)
        // The server's rules: no protocol-relative address, no quotes, spaces or backslashes
        expect(isMailingUrl('//evil.com')).toBe(false)
        expect(isMailingUrl('/a"b')).toBe(false)
        expect(isMailingUrl('/a\\b')).toBe(false)
        expect(isMailingUrl('/a b')).toBe(false)
        expect(isMailingUrl('https://')).toBe(false)
    })
})
