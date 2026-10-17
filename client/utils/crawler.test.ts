import { isCategoryCombination, isCrawler } from './crawler'

describe('isCrawler', () => {
    it.each([
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)',
        'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
        'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider)',
        'meta-externalagent/1.1',
        'curl/7.88.1',
        'python-requests/2.31.0'
    ])('is a crawler: %s', (userAgent) => {
        expect(isCrawler(userAgent)).toBe(true)
    })

    it('takes a request without a user agent as a crawler', () => {
        expect(isCrawler(undefined)).toBe(true)
        expect(isCrawler('')).toBe(true)
    })

    it.each([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 YaBrowser/26.8.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    ])('is a browser: %s', (userAgent) => {
        expect(isCrawler(userAgent)).toBe(false)
    })
})

describe('isCategoryCombination', () => {
    it('is true for 2+ categories, encoded or not', () => {
        expect(isCategoryCombination(new URLSearchParams('category=cave,spring'))).toBe(true)
        expect(isCategoryCombination(new URLSearchParams('category=cave%2Cspring&sort=trending'))).toBe(true)
        expect(isCategoryCombination(new URLSearchParams('category=cave&category=spring,lake'))).toBe(true)
    })

    it('is false for one category or none', () => {
        expect(isCategoryCombination(new URLSearchParams('category=cave'))).toBe(false)
        expect(isCategoryCombination(new URLSearchParams('page=2'))).toBe(false)
    })
})
