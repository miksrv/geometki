<?php
/**
 * Body of an activity email (App\Libraries\Mail\ActivityMail): one event in
 * detail, or several events grouped by place.
 *
 * @var string $locale
 * @var string $userName
 * @var string $headline
 * @var array<int, array{
 *     title: string, url: string, cover: ?string,
 *     events: array<int, array{type: string, actor: string, comment: ?string, rating: ?int}>
 * }> $places
 * @var bool $single One event: show it in detail with the cover and a button
 */

use App\Libraries\Mail\MailText;

$quote = 'margin:12px 0 0;padding:10px 14px;background:#f2f3f5;border-left:3px solid #3770b1;border-radius:4px;font-size:15px;color:#1b1f27;';
$meta  = 'margin:4px 0 0;font-size:14px;color:#6d7885;';
?>
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;"><?= esc($headline) ?></h1>
<p style="margin:0 0 20px;"><?= esc(MailText::get($locale, 'greeting', ['name' => $userName])) ?>
    <?php if (!$single): ?><?= esc(MailText::get($locale, 'groupIntro')) ?><?php endif; ?>
</p>

<?php if ($single): ?>
    <?php $place = $places[0]; $event = $place['events'][0]; ?>
    <?php if ($place['cover']): ?>
        <a href="<?= esc($place['url']) ?>" style="text-decoration:none;">
            <img src="<?= esc($place['cover']) ?>" width="536" alt="<?= esc($place['title']) ?>" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;margin:0 0 16px;">
        </a>
    <?php endif; ?>
    <div><a href="<?= esc($place['url']) ?>" class="gm-link" style="font-size:18px;font-weight:bold;color:#2a73c7;text-decoration:none;"><?= esc($place['title']) ?></a></div>
    <p class="gm-muted" style="<?= $meta ?>"><?= esc(MailText::get($locale, 'event_' . $event['type'])) ?> · <?= esc($event['actor']) ?></p>
    <?php if ($event['rating']): ?>
        <p style="margin:12px 0 0;"><?= esc(MailText::get($locale, 'ratingValue', ['value' => $event['rating']])) ?></p>
    <?php endif; ?>
    <?php if ($event['comment']): ?>
        <p class="gm-quote" style="<?= $quote ?>"><?= nl2br(esc($event['comment'])) ?></p>
    <?php endif; ?>
    <?php if ($event['type'] === 'edit'): ?>
        <p style="margin:12px 0 0;"><?= esc(MailText::get($locale, 'editHint')) ?></p>
    <?php endif; ?>
    <?= view('emails/partials/button', ['text' => MailText::get($locale, 'openPlace'), 'url' => $place['url']]) ?>
<?php else: ?>
    <?php foreach ($places as $index => $place): ?>
        <?php if ($index > 0): ?>
            <hr class="gm-divider" style="border:none;border-top:1px solid #e1e3e6;margin:20px 0;">
        <?php endif; ?>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <?php if ($place['cover']): ?>
                    <td width="96" valign="top" style="width:96px;padding-right:14px;">
                        <a href="<?= esc($place['url']) ?>" style="text-decoration:none;">
                            <img src="<?= esc($place['cover']) ?>" width="96" alt="" style="display:block;width:96px;height:auto;border:0;border-radius:6px;">
                        </a>
                    </td>
                <?php endif; ?>
                <td valign="top">
                    <div><a href="<?= esc($place['url']) ?>" class="gm-link" style="font-size:16px;font-weight:bold;color:#2a73c7;text-decoration:none;"><?= esc($place['title']) ?></a></div>
                    <?php foreach ($place['events'] as $event): ?>
                        <p class="gm-muted" style="<?= $meta ?>">
                            <?= esc(MailText::get($locale, 'event_' . $event['type'])) ?> · <?= esc($event['actor']) ?><?php if ($event['rating']): ?> · <?= (int) $event['rating'] ?>/5<?php endif; ?>
                        </p>
                        <?php if ($event['comment']): ?>
                            <p class="gm-quote" style="<?= $quote ?>margin-top:6px;"><?= esc(mb_strimwidth($event['comment'], 0, 160, '…')) ?></p>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </td>
            </tr>
        </table>
    <?php endforeach; ?>
<?php endif; ?>
