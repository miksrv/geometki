<?php
/**
 * A "bulletproof" button: a table cell with the background, so it keeps its
 * shape in Outlook and in clients that strip padding from links.
 *
 * @var string $text
 * @var string $url
 */
?>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="gm-btn" style="margin:24px 0 8px;">
    <tr>
        <td align="center" bgcolor="#3770b1" style="border-radius:8px;background:#3770b1;">
            <a href="<?= esc($url) ?>" target="_blank" style="display:inline-block;padding:12px 28px;font-size:16px;font-weight:bold;line-height:1.25;color:#ffffff;text-decoration:none;border-radius:8px;"><?= esc($text) ?></a>
        </td>
    </tr>
</table>
