<?php
/**
 * Body of a news mailing (App\Libraries\Mail\MailingMail), wrapped in emails/layout:
 * the picture on top, the text, an optional button.
 *
 * @var string      $locale
 * @var string      $subject
 * @var string|null $imageUrl    Absolute address of the picture
 * @var string      $contentHtml The text as HTML (MailingContent::toHtml(), already escaped)
 * @var string|null $buttonText
 * @var string|null $buttonUrl
 */
?>
<?php if (!empty($imageUrl)): ?>
    <img src="<?= esc($imageUrl) ?>" alt="<?= esc($subject) ?>" width="536" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:8px;margin:0 0 20px;">
<?php endif; ?>
<?= $contentHtml ?>
<?php if (!empty($buttonText) && !empty($buttonUrl)): ?>
    <?= view('emails/partials/button', ['text' => $buttonText, 'url' => $buttonUrl], ['saveData' => false]) ?>
<?php endif; ?>
