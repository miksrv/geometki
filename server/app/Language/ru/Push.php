<?php

/**
 * Texts of push notifications (App\Libraries\Push\PushPayload) and of the push API.
 * `{name}` are placeholders; plural keys hold `one|few|many` forms.
 */
return [
    'event_comment'  => 'Новый комментарий',
    'event_photo'    => 'Новая фотография',
    'event_rating'   => 'Новая оценка',
    'event_edit'     => 'Правка описания',
    'event_cover'    => 'Новая обложка',
    'event_bookmark' => 'Добавлено в закладки',
    'event_visit'    => 'Отмечено посещение',
    'guest'          => 'Гость',
    'ratingValue'    => '{value} из 5',

    'groupTitle'  => 'На ваших местах {events}',
    'eventsCount' => 'новое событие|новых события|новых событий',
    'morePlaces'  => 'и ещё {places}',
    'places'      => 'место|места|мест',

    'achievementTitle' => 'Новое достижение',
    'achievementBody'  => '«{title}» — загляните в свой профиль',
    'levelTitle'       => 'Новый уровень: {level}',
    'levelBody'        => 'Так держать! Посмотрите, что открылось на новом уровне',

    'testTitle' => 'Push-уведомления включены',
    'testBody'  => 'Так будут приходить новости о ваших местах на Геометках',

    // API
    'notConfigured'       => 'Push-уведомления на сервере не настроены',
    'invalidSubscription' => 'Неверные данные подписки',
    'noSubscriptions'     => 'На этом аккаунте нет устройств с включёнными push-уведомлениями',
    'tooManyTests'        => 'Слишком много тестовых уведомлений, попробуйте через минуту',
    'testFailed'          => 'Не удалось отправить тестовое уведомление',
];
