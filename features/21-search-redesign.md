# Feature 21 — Search: русская морфология

> Контекст: редизайн поиска сделан (`GET /search`, `GET /search/suggest` в `server/app/Controllers/Search.php`, страница `client/pages/search/`). Релевантность — MySQL FULLTEXT (`ft_title`, `ft_content`) с весом title × 10, бустом по просмотрам и локали в `server/app/Libraries/PlacesContent.php::search`; запросы ≤ 3 символов идут через `LIKE`. Открыта только морфология.

FULLTEXT в MySQL не знает русской морфологии: «лагеря» не находит «лагерь», «заброшенный» — «Заброшенное». Варианты по возрастанию затрат:

1. FULLTEXT-индекс `WITH PARSER ngram` — встроен в MySQL, находит частичные совпадения, но индекс в 3–5 раз больше и бывают ложные срабатывания.
2. Стемминг запроса и текста в PHP.
3. Отдельный сервис с русской морфологией: Manticore Search или MeiliSearch (ElasticSearch — избыточно).
