<?php

/**
 * Texts of the emails (App\Libraries\Mail\*, Views/emails/*).
 * `{name}` are placeholders; plural keys hold `one|few|many` forms.
 */
return [
    // Layout
    'brand'              => 'Геометки',
    'footerReason'       => 'Вы получили это письмо, потому что зарегистрированы на Геометках и включили уведомления по почте.',
    'footerReasonAuth'   => 'Письмо отправлено, потому что на Геометках запросили вход с этим адресом.',
    'footerSettings'     => 'Настройки уведомлений',
    'footerUnsubscribe'  => 'Отписаться от таких писем',

    // Common
    'greeting'  => 'Здравствуйте, {name}!',
    'guest'     => 'Гость',
    'openPlace' => 'Открыть место',

    // Activity on the user's places
    'subject_comment'  => 'Новый комментарий к месту «{place}»',
    'subject_photo'    => 'Новая фотография места «{place}»',
    'subject_rating'   => 'Новая оценка места «{place}»',
    'subject_edit'     => 'Место «{place}» отредактировали',
    'subject_cover'    => 'Новая обложка места «{place}»',
    'subject_bookmark' => 'Место «{place}» добавили в закладки',
    'subject_visit'    => 'Место «{place}» отметили как посещённое',
    'subjectGroup'     => 'На ваших местах {events}',

    'headline_comment'  => 'Новый комментарий к вашему месту',
    'headline_photo'    => 'Новая фотография вашего места',
    'headline_rating'   => 'Новая оценка вашего места',
    'headline_edit'     => 'Ваше место отредактировали',
    'headline_cover'    => 'У вашего места новая обложка',
    'headline_bookmark' => 'Ваше место добавили в закладки',
    'headline_visit'    => 'Ваше место отметили как посещённое',
    'headlineGroup'     => 'На ваших местах {events}',

    'event_comment'  => 'Новый комментарий',
    'event_photo'    => 'Новая фотография',
    'event_rating'   => 'Новая оценка',
    'event_edit'     => 'Правка описания',
    'event_cover'    => 'Новая обложка',
    'event_bookmark' => 'Добавлено в закладки',
    'event_visit'    => 'Отмечено посещение',

    'eventsCount'  => 'новое событие|новых события|новых событий',
    'ratingValue'  => 'Оценка: {value} из 5',
    'editHint'     => 'Проверьте, что изменилось, — правки делают место полезнее для других путешественников.',
    'groupIntro'   => 'Пока вы были заняты, на ваших местах кое-что произошло:',

    // Weekly digest
    'digestSubject'        => 'Ваша неделя на Геометках',
    'digestSubjectSite'    => 'Что нового на Геометках за неделю',
    'digestSubjectViews'   => 'Ваши места посмотрели {views} за неделю',
    'digestSubjectEvents'  => 'На ваших местах {events} за неделю',
    'digestTimes'          => 'раз|раза|раз',
    'digestGreeting'       => 'Привет, {name}! Вот что произошло за неделю на Геометках.',
    'digestYourPlaces'     => 'Ваши места за неделю',
    'digestMorePlaces'     => 'и ещё {places}',
    'digestTopPlaces'      => 'Популярные места недели',
    'digestYou'            => 'Вы за неделю: {stats}',
    'digestViews'          => 'просмотр|просмотра|просмотров',
    'digestRatings'        => 'оценка|оценки|оценок',
    'digestComments'       => 'комментарий|комментария|комментариев',
    'digestPhotos'         => 'фотография|фотографии|фотографий',
    'digestEdits'          => 'правка|правки|правок',
    'digestSiteWeek'       => 'Неделя на Геометках',
    'pulsePlaces'          => 'новое место|новых места|новых мест',
    'pulsePhotos'          => 'фото|фото|фото',
    'pulseComments'        => 'отзыв|отзыва|отзывов',
    'pulseRatings'         => 'оценка|оценки|оценок',
    'pulseCollections'     => 'коллекция|коллекции|коллекций',
    'pulseEdits'           => 'правка|правки|правок',
    'digestAuthors'        => 'участник сделал это|участника сделали это|участников сделали это',
    'digestHighlights'     => 'Главное за неделю',
    'storyPlace'           => 'Новое место',
    'storyPhotos'          => 'новое фото|новых фото|новых фото',
    'storyCollection'      => 'Коллекция',
    'storyComment'         => 'Отзыв',
    'storyAchievement'     => 'Достижение',
    'storyLevel'           => 'Новый уровень',
    'storyLevelTitle'      => 'Уровень {level}',
    'collectionPlaces'     => 'место|места|мест',
    'digestOpenFeed'       => 'Открыть ленту',

    // Sign-in link
    'magicLinkSubject' => 'Ссылка для входа на Геометки',
    'magicLinkTitle'   => 'Вход на Геометки',
    'magicLinkIntro'   => 'Нажмите на кнопку ниже, чтобы войти.',
    'magicLinkButton'  => 'Войти',
    'magicLinkExpiry'  => 'Ссылка действительна 5 минут и сработает один раз.',
    'magicLinkIgnore'  => 'Если вы не запрашивали вход, просто проигнорируйте это письмо — без перехода по ссылке ничего не произойдёт.',
    'magicLinkFallback' => 'Если кнопка не работает, скопируйте ссылку в адресную строку браузера:',
];
