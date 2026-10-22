<?php
/**
 * Body of the weekly digest (App\Libraries\Mail\DigestMail), wrapped in
 * emails/layout when the queue sends it. Personal news first (the user's
 * places, the user's own week; without news of own places the most viewed
 * places of the week), then the week of the whole site — the same numbers,
 * people and key stories as the feed summary of the home page.
 *
 * @var string $locale
 * @var string $userName
 * @var array  $sections   DigestService::generateForUser(): place_activity or top_places, week_summary, site
 * @var array  $highlights DigestMail::highlight() items
 */

use App\Libraries\Mail\DigestMail;
use App\Libraries\Mail\MailText;
use App\Libraries\Mail\MailUrls;

$h2    = 'margin:0 0 12px;font-size:17px;line-height:1.3;';
$hr    = '<hr class="gm-divider" style="border:none;border-top:1px solid #e1e3e6;margin:24px 0 20px;">';
$muted = 'color:#6d7885;';
$pulse = $sections['site']['pulse'] ?? null;
?>
<p style="margin:0;"><?= esc(MailText::get($locale, 'digestGreeting', ['name' => $userName])) ?></p>

<?php if (!empty($sections['place_activity'])): ?>
    <?= $hr ?>
    <h2 style="<?= $h2 ?>"><?= esc(MailText::get($locale, 'digestYourPlaces')) ?></h2>

    <?php foreach (array_slice($sections['place_activity'], 0, DigestMail::YOUR_PLACES) as $place): ?>
        <?php
        $url   = MailUrls::place($locale, $place['place_id'], $place['slug'] ?? null);
        $parts = [];
        foreach (['views' => 'digestViews', 'ratings' => 'digestRatings', 'comments' => 'digestComments', 'photos' => 'digestPhotos', 'edits' => 'digestEdits'] as $field => $forms) {
            if (($place[$field] ?? 0) > 0) {
                $parts[] = MailText::plural($locale, $forms, (int) $place[$field]);
            }
        }
        ?>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
            <tr>
                <?php if (!empty($place['cover'])): ?>
                    <td width="96" valign="top" style="width:96px;padding-right:14px;">
                        <a href="<?= esc($url) ?>" style="text-decoration:none;">
                            <img src="<?= esc($place['cover']) ?>" width="96" alt="" style="display:block;width:96px;height:auto;border:0;border-radius:6px;">
                        </a>
                    </td>
                <?php endif; ?>
                <td valign="middle">
                    <div><a href="<?= esc($url) ?>" class="gm-link" style="font-size:16px;font-weight:bold;color:#2a73c7;text-decoration:none;"><?= esc($place['title']) ?></a></div>
                    <?php if ($parts): ?>
                        <p class="gm-muted" style="margin:4px 0 0;font-size:14px;<?= $muted ?>"><?= esc(implode(' · ', $parts)) ?></p>
                    <?php endif; ?>
                </td>
            </tr>
        </table>
    <?php endforeach; ?>
    <?php if (($more = count($sections['place_activity']) - DigestMail::YOUR_PLACES) > 0): ?>
        <p class="gm-muted" style="margin:0;font-size:14px;<?= $muted ?>"><?= esc(MailText::get($locale, 'digestMorePlaces', ['places' => MailText::plural($locale, 'collectionPlaces', $more)])) ?></p>
    <?php endif; ?>
<?php endif; ?>

<?php
$mine = [];
foreach (['places_created' => 'pulsePlaces', 'photos_uploaded' => 'pulsePhotos', 'ratings_given' => 'pulseRatings', 'edits_made' => 'pulseEdits'] as $field => $forms) {
    if (($sections['week_summary'][$field] ?? 0) > 0) {
        $mine[] = MailText::plural($locale, $forms, (int) $sections['week_summary'][$field]);
    }
}
?>
<?php if ($mine): ?>
    <p style="margin:<?= empty($sections['place_activity']) ? '20px' : '4px' ?> 0 0;"><?= esc(MailText::get($locale, 'digestYou', ['stats' => implode(' · ', $mine)])) ?></p>
<?php endif; ?>

<?php if (!empty($sections['top_places'])): ?>
    <?= $hr ?>
    <h2 style="<?= $h2 ?>"><?= esc(MailText::get($locale, 'digestTopPlaces')) ?></h2>

    <?php foreach ($sections['top_places'] as $place): ?>
        <?php $url = MailUrls::place($locale, $place['place_id'], $place['slug'] ?? null); ?>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
            <tr>
                <?php if (!empty($place['cover'])): ?>
                    <td width="96" valign="top" style="width:96px;padding-right:14px;">
                        <a href="<?= esc($url) ?>" style="text-decoration:none;">
                            <img src="<?= esc($place['cover']) ?>" width="96" alt="" style="display:block;width:96px;height:auto;border:0;border-radius:6px;">
                        </a>
                    </td>
                <?php endif; ?>
                <td valign="middle">
                    <div><a href="<?= esc($url) ?>" class="gm-link" style="font-size:16px;font-weight:bold;color:#2a73c7;text-decoration:none;"><?= esc($place['title']) ?></a></div>
                    <p class="gm-muted" style="margin:4px 0 0;font-size:14px;<?= $muted ?>"><?= esc(MailText::plural($locale, 'digestViews', (int) $place['views'])) ?></p>
                </td>
            </tr>
        </table>
    <?php endforeach; ?>
<?php endif; ?>

<?php
$stats = [];
foreach (DigestMail::PULSE_STATS as [$field, $forms]) {
    if (($pulse[$field] ?? 0) > 0) {
        $stats[] = ['count' => (int) $pulse[$field], 'label' => MailText::pluralForm($locale, $forms, (int) $pulse[$field])];
    }
}
?>
<?php if ($stats || !empty($pulse['users'])): ?>
    <?= $hr ?>
    <h2 style="<?= $h2 ?>"><?= esc(MailText::get($locale, 'digestSiteWeek')) ?></h2>

    <?php if ($stats): ?>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
            <?php foreach (array_chunk($stats, 3) as $row): ?>
                <tr>
                    <?php foreach ($row as $stat): ?>
                        <td width="33%" valign="top" style="width:33%;padding:0 8px 12px 0;">
                            <span style="display:block;font-size:24px;font-weight:bold;line-height:1.2;"><?= $stat['count'] ?></span>
                            <span class="gm-muted" style="display:block;font-size:13px;<?= $muted ?>"><?= esc($stat['label']) ?></span>
                        </td>
                    <?php endforeach; ?>
                    <?php for ($i = count($row); $i < 3; $i++): ?>
                        <td width="33%" style="width:33%;"></td>
                    <?php endfor; ?>
                </tr>
            <?php endforeach; ?>
        </table>
    <?php endif; ?>

    <?php if (!empty($pulse['users'])): ?>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <?php foreach ($pulse['users'] as $person): ?>
                    <td style="padding-right:4px;">
                        <a href="<?= esc(MailUrls::user($locale, $person['id'])) ?>" title="<?= esc($person['name']) ?>" style="text-decoration:none;">
                            <img src="<?= esc($person['avatar'] ? MailUrls::upload($person['avatar']) : MailUrls::noAvatar()) ?>" width="32" height="32" alt="<?= esc($person['name']) ?>" style="display:block;width:32px;height:32px;border:0;border-radius:16px;">
                        </a>
                    </td>
                <?php endforeach; ?>
                <td class="gm-muted" style="padding-left:8px;font-size:14px;<?= $muted ?>">
                    <?= esc(MailText::plural($locale, 'digestAuthors', (int) $pulse['authors'])) ?>
                </td>
            </tr>
        </table>
    <?php endif; ?>
<?php endif; ?>

<?php if ($highlights): ?>
    <?= $hr ?>
    <h2 style="<?= $h2 ?>"><?= esc(MailText::get($locale, 'digestHighlights')) ?></h2>

    <?php foreach ($highlights as $item): ?>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
            <tr>
                <td width="96" valign="top" align="center" style="width:96px;padding-right:14px;">
                    <?php if ($item['image']): ?>
                        <a href="<?= esc($item['url']) ?>" style="text-decoration:none;">
                            <?php if ($item['square']): ?>
                                <img src="<?= esc($item['image']) ?>" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;border-radius:24px;">
                            <?php else: ?>
                                <img src="<?= esc($item['image']) ?>" width="96" alt="" style="display:block;width:96px;height:auto;border:0;border-radius:6px;">
                            <?php endif; ?>
                        </a>
                    <?php else: ?>
                        <div style="width:96px;height:42px;border-radius:6px;background:#e3eefb;"></div>
                    <?php endif; ?>
                </td>
                <td valign="middle">
                    <div><a href="<?= esc($item['url']) ?>" class="gm-link" style="font-size:16px;font-weight:bold;color:#2a73c7;text-decoration:none;"><?= esc($item['title']) ?></a></div>
                    <p class="gm-muted" style="margin:4px 0 0;font-size:14px;<?= $muted ?>"><?= esc($item['label']) ?><?php if ($item['author'] !== ''): ?> · <?= esc($item['author']) ?><?php endif; ?></p>
                    <?php if ($item['quote']): ?>
                        <p class="gm-quote" style="margin:6px 0 0;padding:8px 12px;background:#f2f3f5;border-left:3px solid #3770b1;border-radius:4px;font-size:14px;"><?= esc($item['quote']) ?></p>
                    <?php endif; ?>
                </td>
            </tr>
        </table>
    <?php endforeach; ?>
<?php endif; ?>

<?= view('emails/partials/button', ['text' => MailText::get($locale, 'digestOpenFeed'), 'url' => MailUrls::site($locale, '/activity')]) ?>
