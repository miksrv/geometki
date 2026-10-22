type Translate = (key: string, options: { defaultValue: string }) => string

export interface ErrorPageTexts {
    title: string
    description: string
    imageAlt: string
    /** The main button */
    action: string
    homeLink: string
}

/**
 * Texts of the 404 page. Not in ErrorPage itself: the App Router 404 (app/not-found.tsx) is
 * rendered outside the Pages Router i18n provider and builds them from the locale file on the
 * server, while pages/404.tsx passes its useTranslation `t`
 */
export const getNotFoundTexts = (t: Translate): ErrorPageTexts => ({
    action: `← ${t('back', { defaultValue: 'Назад' })}`,
    description: t('not-found-description', {
        defaultValue:
            'Похоже, вы забрели не туда. Возможно, это место было удалено, перемещено или никогда не существовало.'
    }),
    homeLink: t('not-found-home-link', { defaultValue: 'Вернуться на начальную страницу' }),
    imageAlt: t('page-not-found', { defaultValue: 'Страница не найдена' }),
    title: t('not-found-title', { defaultValue: 'Место не найдено' })
})

/** Texts of the 500 page (pages/500.tsx) */
export const getServerErrorTexts = (t: Translate): ErrorPageTexts => ({
    action: t('server-error-retry', { defaultValue: 'Попробовать ещё раз' }),
    description: t('server-error-description', {
        defaultValue: 'Сервер не смог открыть эту страницу. Попробуйте ещё раз через минуту.'
    }),
    homeLink: t('not-found-home-link', { defaultValue: 'Вернуться на начальную страницу' }),
    imageAlt: '',
    title: t('server-error-title', { defaultValue: 'Что-то пошло не так' })
})
