<?php
/**
 * Email digest inner template.
 *
 * Variables injected by WeeklyDigestCommand:
 *   @var string $userName
 *   @var array  $sections   Result of DigestService::generateForUser()
 *   @var string $locale     'ru' or 'en'
 *
 * This view renders only the body HTML that will be passed as $message
 * to the outer email.php wrapper.
 */

$isRu = ($locale ?? 'ru') === 'ru';

$t = [
    'greeting'           => $isRu ? "Привет, {$userName}! Вот что произошло за эту неделю на геометках:" : "Hi, {$userName}! Here's what happened this week.",
    'your_week'          => $isRu ? 'Ваша неделя' : 'Your week',
    'places_created'     => $isRu ? 'Новых геометок добавлено' : 'New places added',
    'photos_uploaded'    => $isRu ? 'Фотографий загружено' : 'Photos uploaded',
    'ratings_given'      => $isRu ? 'Оценок поставлено' : 'Ratings given',
    'edits_made'         => $isRu ? 'Правок внесено' : 'Edits made',
    'inactive'           => $isRu ? 'Мы скучаем по вам — загляните на Geometki!' : "We miss you — come back to Geometki!",
    'place_activity'     => $isRu ? 'Активность на ваших геометках' : 'Activity on your places',
    'pa_ratings'         => $isRu ? 'оценок' : 'ratings',
    'pa_comments'        => $isRu ? 'комментариев' : 'comments',
    'pa_photos'          => $isRu ? 'фото' : 'photos',
    'pa_edits'           => $isRu ? 'правок' : 'edits',
    'pa_views'           => $isRu ? 'просмотров' : 'views',
    'place_link'         => $isRu ? 'Открыть' : 'Open',
    'community'          => $isRu ? 'В сообществе за неделю' : 'Community highlights',
    'new_places'         => $isRu ? 'Добавлено новых мест' : 'New places added',
    'top_user'           => $isRu ? 'Активный участник недели' : 'Most active member this week',
    'top_user_level'     => $isRu ? 'уровень' : 'level',
    'top_user_actions'   => $isRu ? 'действий' : 'actions',
];

$hr = '<hr style="border:none;border-top:1px solid #eaebed;margin:16px 0">';
?>

<p style="font-size:16px;margin:0 0 16px"><?= esc($t['greeting']) ?></p>

<?php if (!empty($sections['week_summary'])): ?>
    <?= $hr ?>
    <?php $summary = $sections['week_summary']; ?>
    <h3 style="font-size:16px;font-weight:bold;margin:0 0 12px"><?= esc($t['your_week']) ?></h3>

    <?php if ($summary['is_inactive']): ?>
        <p style="color:#9a9ea6;margin:0 0 8px"><?= esc($t['inactive']) ?></p>
    <?php else: ?>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%">
            <?php if ($summary['places_created'] > 0): ?>
            <tr>
                <td style="padding:4px 0;color:#555"><?= esc($t['places_created']) ?></td>
                <td style="padding:4px 0;text-align:right;font-weight:bold"><?= (int) $summary['places_created'] ?></td>
            </tr>
            <?php endif; ?>
            <?php if ($summary['photos_uploaded'] > 0): ?>
            <tr>
                <td style="padding:4px 0;color:#555"><?= esc($t['photos_uploaded']) ?></td>
                <td style="padding:4px 0;text-align:right;font-weight:bold"><?= (int) $summary['photos_uploaded'] ?></td>
            </tr>
            <?php endif; ?>
            <?php if ($summary['ratings_given'] > 0): ?>
            <tr>
                <td style="padding:4px 0;color:#555"><?= esc($t['ratings_given']) ?></td>
                <td style="padding:4px 0;text-align:right;font-weight:bold"><?= (int) $summary['ratings_given'] ?></td>
            </tr>
            <?php endif; ?>
            <?php if ($summary['edits_made'] > 0): ?>
            <tr>
                <td style="padding:4px 0;color:#555"><?= esc($t['edits_made']) ?></td>
                <td style="padding:4px 0;text-align:right;font-weight:bold"><?= (int) $summary['edits_made'] ?></td>
            </tr>
            <?php endif; ?>
        </table>
    <?php endif; ?>
<?php endif; ?>

<?php if (!empty($sections['place_activity'])): ?>
    <?= $hr ?>
    <h3 style="font-size:16px;font-weight:bold;margin:0 0 12px"><?= esc($t['place_activity']) ?></h3>

    <?php foreach ($sections['place_activity'] as $place): ?>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px">
            <tr>
                <?php if (!empty($place['cover'])): ?>
                <td style="width:120px;vertical-align:top;padding-right:12px">
                    <a href="https://geometki.com/places/<?= esc($place['place_id']) ?>" style="text-decoration:none">
                        <img src="<?= esc($place['cover']) ?>" alt="" style="width:120px;height:45px;object-fit:cover;border-radius:6px;display:block">
                    </a>
                </td>
                <?php endif; ?>
                <td style="vertical-align:top">
                    <a href="https://geometki.com/places/<?= esc($place['place_id']) ?>" style="color:#0867ec;text-decoration:none;font-weight:bold;font-size:15px;display:block;margin-bottom:4px;white-space: nowrap;overflow: hidden;max-width: 416px;text-overflow: ellipsis;">
                        <?= esc($place['title']) ?>
                    </a>
                    <span style="font-size:13px;color:#9a9ea6">
                        <?php
                        $parts = [];
                        if (($place['views'] ?? 0) > 0) $parts[] = $place['views'] . ' ' . $t['pa_views'];
                        if ($place['ratings']  > 0) $parts[] = $place['ratings']  . ' ' . $t['pa_ratings'];
                        if ($place['comments'] > 0) $parts[] = $place['comments'] . ' ' . $t['pa_comments'];
                        if ($place['photos']   > 0) $parts[] = $place['photos']   . ' ' . $t['pa_photos'];
                        if ($place['edits']    > 0) $parts[] = $place['edits']    . ' ' . $t['pa_edits'];
                        echo esc(implode(' · ', $parts));
                        ?>
                    </span>
                </td>
            </tr>
        </table>
    <?php endforeach; ?>
<?php endif; ?>

<?php if (!empty($sections['community'])): ?>
    <?php $community = $sections['community']; ?>
    <?php $hasContent = ($community['new_places_count'] ?? 0) > 0 || !empty($community['top_user']); ?>
    <?php if ($hasContent): ?>
    <?= $hr ?>
    <h3 style="font-size:16px;font-weight:bold;margin:0 0 12px"><?= esc($t['community']) ?></h3>

    <?php if ($community['new_places_count'] > 0): ?>
        <p style="margin:0 0 8px">
            <?= esc($t['new_places']) ?>: <strong><?= (int) $community['new_places_count'] ?></strong>
        </p>
    <?php endif; ?>

    <?php if (!empty($community['top_user'])): ?>
        <?php $topUser = $community['top_user']; ?>
        <p style="margin:0 0 8px">
            <?= esc($t['top_user']) ?>:
            <strong><?= esc($topUser['name']) ?></strong>
            <span style="color:#9a9ea6;font-size:13px">
                (<?= esc($t['top_user_level']) ?> <?= (int) $topUser['level'] ?>,
                <?= (int) $topUser['activity_count'] ?> <?= esc($t['top_user_actions']) ?>)
            </span>
        </p>
    <?php endif; ?>
    <?php endif; ?>
<?php endif; ?>
