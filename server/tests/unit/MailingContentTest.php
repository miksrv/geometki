<?php

use App\Libraries\Mail\MailingContent;
use App\Libraries\Mail\MailingMail;
use App\Libraries\Mail\MailQueue;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Notifications;

/**
 * The text of a mailing (the safe markup), its letter and the shared bulk limits. No database, no SMTP.
 *
 * @internal
 */
final class MailingContentTest extends CIUnitTestCase
{
    public function testParagraphsAndLineBreaks(): void
    {
        $html = MailingContent::toHtml("First line\nsecond line\n\nSecond paragraph", 'ru');

        $this->assertSame(2, substr_count($html, '<p '));
        $this->assertStringContainsString('First line<br>second line', $html);
        $this->assertStringContainsString('Second paragraph</p>', $html);
        $this->assertSame('', MailingContent::toHtml("  \n\n ", 'ru'));
    }

    public function testHtmlIsEscaped(): void
    {
        $html = MailingContent::toHtml('<script>alert("x")</script> & <b>bold</b>', 'ru');

        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('<b>', $html);
        $this->assertStringContainsString('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;', $html);
    }

    public function testBold(): void
    {
        $html = MailingContent::toHtml('A **new** place and **two words** here, 2 * 3 ** 4 stays', 'ru');

        $this->assertStringContainsString('A <strong>new</strong> place and <strong>two words</strong> here', $html);
        $this->assertStringContainsString('2 * 3 ** 4 stays', $html);
    }

    public function testLinks(): void
    {
        $html = MailingContent::toHtml('See [the site](https://example.com/a?b=1&c=2) now', 'ru');

        $this->assertStringContainsString('<a href="https://example.com/a?b=1&amp;c=2"', $html);
        $this->assertStringContainsString('>the site</a>', $html);
    }

    public function testSitePathsAreAbsoluteAndLocalised(): void
    {
        $ru = MailingContent::toHtml('[Game](/game)', 'ru');
        $en = MailingContent::toHtml('[Game](/game)', 'en');

        $this->assertMatchesRegularExpression('#href="https?://[^"/]+/game"#', $ru);
        $this->assertMatchesRegularExpression('#href="https?://[^"/]+/en/game"#', $en);
    }

    public function testOtherSchemesStayPlainText(): void
    {
        foreach (['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c', '//evil.example/x', 'ftp://x.example/f', 'JaVaScRiPt:alert(1)'] as $url) {
            $html = MailingContent::toHtml("[click]({$url})", 'ru');

            $this->assertStringNotContainsString('<a ', $html, $url);
            $this->assertStringNotContainsString('href', $html, $url);
            $this->assertStringContainsString('[click](', $html, $url);
        }
    }

    public function testLinkTextIsEscapedAndCannotBreakTheAttribute(): void
    {
        $html = MailingContent::toHtml('[<i>x</i>](https://example.com/"onmouseover="alert(1))', 'ru');

        $this->assertStringNotContainsString('<i>', $html);
        $this->assertStringNotContainsString('<a ', $html, 'a url with a quote is not a link');
    }

    public function testBulletedList(): void
    {
        $html = MailingContent::toHtml("What is new:\n- a **map**\n- [quests](/quests)\n\nThanks", 'ru');

        $this->assertSame(1, substr_count($html, '<ul '));
        $this->assertSame(2, substr_count($html, '<li '));
        $this->assertStringContainsString('<li style="margin:0 0 4px;">a <strong>map</strong></li>', $html);
        $this->assertStringContainsString('What is new:</p>', $html);
        $this->assertStringContainsString('Thanks</p>', $html);
        $this->assertStringNotContainsString('<li style="margin:0 0 4px;">-', $html);
    }

    public function testADashWithoutASpaceIsNotAListItem(): void
    {
        $this->assertStringNotContainsString('<ul', MailingContent::toHtml('-5 degrees', 'ru'));
    }

    public function testLinkUrlRules(): void
    {
        $this->assertTrue(MailingContent::isLinkUrl('https://example.com'));
        $this->assertTrue(MailingContent::isLinkUrl('http://example.com/a?b=c#d'));
        $this->assertTrue(MailingContent::isLinkUrl('/game/help'));
        $this->assertFalse(MailingContent::isLinkUrl(''));
        $this->assertFalse(MailingContent::isLinkUrl('//example.com'));
        $this->assertFalse(MailingContent::isLinkUrl('https://'));
        $this->assertFalse(MailingContent::isLinkUrl('javascript:alert(1)'));
        $this->assertFalse(MailingContent::isLinkUrl('example.com'));
        $this->assertFalse(MailingContent::isLinkUrl("https://example.com/a b"));
        $this->assertFalse(MailingContent::isLinkUrl('/path"onclick="x'));
    }

    public function testTheLetter(): void
    {
        $mailing = [
            'subject'      => 'Новая версия',
            'content'      => "Привет!\n\n- **Квесты** [тут](/quests)",
            'button_label' => 'Открыть',
            'button_url'   => '/game',
            'image'        => 'uploads/mailings/abc/pic.jpg',
        ];

        $letter = MailingMail::render($mailing, 'https://example.com/unsubscribe?token=x');

        $this->assertSame('Новая версия', $letter['subject']);
        $this->assertStringContainsString('uploads/mailings/abc/pic.jpg', $letter['html']);
        $this->assertStringContainsString('<strong>Квесты</strong>', $letter['html']);
        $this->assertStringContainsString('class="gm-btn"', $letter['html']);
        $this->assertStringContainsString('Открыть', $letter['html']);
        $this->assertStringContainsString('https://example.com/unsubscribe?token=x', $letter['html']);
        $this->assertStringContainsString('Привет!', $letter['text']);

        // A mailing is Russian only: its links never go to the English site
        $this->assertMatchesRegularExpression('#href="https?://[^"/]+/game"#', $letter['html']);
        $this->assertStringNotContainsString('/en/', $letter['html']);
        $this->assertStringContainsString('lang="ru"', $letter['html']);
    }

    public function testNoUrlNoButton(): void
    {
        $letter = MailingMail::render(['subject' => 'T', 'content' => 'Text', 'button_label' => 'Open', 'button_url' => null, 'image' => null], null);

        $this->assertStringNotContainsString('class="gm-btn"', $letter['html']);
        $this->assertStringNotContainsString('Open', $letter['html']);
    }

    public function testBulkLimitsCountDigestsAndMailingsTogether(): void
    {
        $config                  = new Notifications();
        $config->batchSize       = 100;
        $config->digestHourLimit = 500;
        $config->digestDayLimit  = 2000;

        // The caller passes the digests and the news letters sent in the window together
        $this->assertSame(50, MailQueue::digestBudget($config, 300 + 150, 0));
        $this->assertSame(0, MailQueue::digestBudget($config, 200 + 300, 0));
        $this->assertSame(10, MailQueue::digestBudget($config, 0, 1500 + 490));
    }

    public function testNewsIsAnEmailOnlyType(): void
    {
        $settings = new \App\Libraries\NotificationSettings(new Notifications());

        $this->assertTrue($settings->isKnownType('news'));
        $this->assertContains('emailNews', $settings->keys());
        $this->assertNotContains('pushNews', $settings->keys());
        $this->assertTrue($settings->isEnabled(null, 'email', 'news'), 'on by default');
        $this->assertFalse($settings->isEnabled((object) ['emailNews' => false], 'email', 'news'));
        $this->assertFalse($settings->isEnabled(null, 'push', 'news'));
        $this->assertFalse($settings->disable(null, 'email', 'news')->emailNews);
        $this->assertTrue($settings->disable(null, 'email', 'activity')->emailNews, 'an activity scope leaves the news on');
    }
}
