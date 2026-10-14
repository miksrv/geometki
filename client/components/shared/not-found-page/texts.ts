export interface NotFoundTexts {
    title: string
    description: string
    imageAlt: string
    back: string
    homeLink: string
}

/**
 * Texts of the 404 page. Not in NotFoundPage itself: the App Router 404 (app/not-found.tsx) is
 * rendered outside the Pages Router i18n provider and builds them from the locale file on the
 * server, while pages/404.tsx passes its useTranslation `t`
 */
export const getNotFoundTexts = (t: (key: string, options: { defaultValue: string }) => string): NotFoundTexts => ({
    back: t('back', { defaultValue: 'Назад' }),
    description: t('not-found-description', {
        defaultValue:
            'Похоже, вы забрели не туда. Возможно, это место было удалено, перемещено или никогда не существовало.'
    }),
    homeLink: t('not-found-home-link', { defaultValue: 'Вернуться на начальную страницу' }),
    imageAlt: t('page-not-found', { defaultValue: 'Страница не найдена' }),
    title: t('not-found-title', { defaultValue: 'Место не найдено' })
})
