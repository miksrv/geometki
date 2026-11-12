import { getSortLabel, getSortPresets } from './sortPresets'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = ((key: string, defaultValue?: string) => defaultValue ?? key) as any

describe('getSortPresets', () => {
    it('offers "Для вас" and "Посещённые" to a signed-in visitor only', () => {
        const guest = getSortPresets(t, false).map(({ key }) => key)
        const signedIn = getSortPresets(t, true).map(({ key }) => key)

        expect(guest).not.toContain('recommended')
        expect(guest).not.toContain('visited')
        expect(signedIn.slice(0, 3)).toStrictEqual(['trending', 'recommended', 'visited'])
    })

    it('names the visited sort', () => {
        expect(getSortLabel(t, 'visited')).toBe('Посещённые')
    })
})
