<?php
/**
 * The frame of every email: logo, a white card with $content, the footer.
 * Styles are inline (mail clients drop or ignore <style>); the <style> block
 * only adds the mobile and dark-mode refinements where they are supported.
 *
 * Rendered by App\Libraries\Mail\MailRenderer.
 *
 * @var string      $locale          'ru' | 'en'
 * @var string      $subject         Used as the document title
 * @var string      $preheader       Inbox preview text (plain text)
 * @var string      $content         The body HTML (already escaped by its view)
 * @var string      $footerReason    Why the recipient got the email (plain text)
 * @var string|null $settingsUrl     Notification settings page
 * @var string|null $unsubscribeUrl  Unsubscribe page for this kind of email
 * @var string      $siteUrl
 * @var string      $logoUrl
 */

use App\Libraries\Mail\MailText;

$font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
?>
<!doctype html>
<html lang="<?= esc($locale) ?>" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title><?= esc($subject) ?></title>
    <style>
        @media only screen and (max-width: 620px) {
            .gm-outer { padding: 12px 0 !important; }
            .gm-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; padding: 20px 16px !important; }
            .gm-btn a { display: block !important; }
        }
        @media (prefers-color-scheme: dark) {
            .gm-body, .gm-outer { background: #19191a !important; }
            .gm-card { background: #232324 !important; border-color: #363738 !important; color: #e1e3e6 !important; }
            .gm-text { color: #e1e3e6 !important; }
            .gm-muted { color: #939aa3 !important; }
            .gm-link { color: #66a2eb !important; }
            .gm-quote { background: #2c2d2e !important; border-color: #4f93e6 !important; color: #e1e3e6 !important; }
            .gm-divider { border-color: #363738 !important; }
        }
    </style>
</head>
<body class="gm-body" style="margin:0;padding:0;background:#f2f3f5;-webkit-text-size-adjust:100%;">
<?php if (!empty($preheader)): ?>
<div class="gm-preheader" style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f2f3f5;"><?= esc($preheader) ?><?= str_repeat('&#847;&zwnj;&nbsp;', 40) ?></div>
<?php endif; ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="gm-outer" style="background:#f2f3f5;">
    <tr>
        <td align="center" class="gm-outer" style="padding:24px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
                <tr>
                    <td style="padding:0 4px 16px;font-family:<?= $font ?>;">
                        <a href="<?= esc($siteUrl) ?>" style="text-decoration:none;color:#1b1f27;" class="gm-text">
                            <img src="<?= esc($logoUrl) ?>" width="32" height="32" alt="" style="vertical-align:middle;border:0;border-radius:8px;">
                            <span style="vertical-align:middle;font-size:18px;font-weight:bold;padding-left:8px;"><?= esc(MailText::get($locale, 'brand')) ?></span>
                        </a>
                    </td>
                </tr>
                <tr>
                    <td class="gm-card gm-text" style="background:#ffffff;border:1px solid #e1e3e6;border-radius:12px;padding:28px 32px;font-family:<?= $font ?>;font-size:16px;line-height:1.5;color:#1b1f27;">
                        <?= $content ?>
                    </td>
                </tr>
                <tr>
                    <td class="gm-muted" style="padding:16px 4px 0;font-family:<?= $font ?>;font-size:13px;line-height:1.5;color:#6d7885;">
                        <?= esc($footerReason) ?>
                        <?php
                        $links = [];
                        if (!empty($settingsUrl)) {
                            $links[] = '<a href="' . esc($settingsUrl) . '" class="gm-link" style="color:#2a73c7;">' . esc(MailText::get($locale, 'footerSettings')) . '</a>';
                        }
                        if (!empty($unsubscribeUrl)) {
                            $links[] = '<a href="' . esc($unsubscribeUrl) . '" class="gm-link" style="color:#2a73c7;">' . esc(MailText::get($locale, 'footerUnsubscribe')) . '</a>';
                        }
                        ?>
                        <?php if ($links): ?>
                            <br><br><?= implode('<br>', $links) ?>
                        <?php endif; ?>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
