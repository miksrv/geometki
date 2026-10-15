<?php
/**
 * Body of the sign-in link email (App\Libraries\Mail\MagicLinkMail).
 *
 * @var string $locale
 * @var string $link
 */

use App\Libraries\Mail\MailText;
?>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;"><?= esc(MailText::get($locale, 'magicLinkTitle')) ?></h1>
<p style="margin:0;"><?= esc(MailText::get($locale, 'magicLinkIntro')) ?></p>
<?= view('emails/partials/button', ['text' => MailText::get($locale, 'magicLinkButton'), 'url' => $link]) ?>
<p class="gm-muted" style="margin:16px 0 0;font-size:14px;color:#6d7885;"><?= esc(MailText::get($locale, 'magicLinkExpiry')) ?></p>
<p class="gm-muted" style="margin:16px 0 0;font-size:14px;color:#6d7885;"><?= esc(MailText::get($locale, 'magicLinkIgnore')) ?></p>
<p class="gm-muted" style="margin:16px 0 0;font-size:13px;color:#6d7885;word-break:break-all;">
    <?= esc(MailText::get($locale, 'magicLinkFallback')) ?><br>
    <a href="<?= esc($link) ?>" class="gm-link" style="color:#2a73c7;"><?= esc($link) ?></a>
</p>
