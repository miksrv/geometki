<?php

use App\Libraries\DigestService;
use App\Libraries\Mail\ActivityMail;
use App\Libraries\Mail\DigestMail;
use App\Libraries\Mail\Mailer;
use App\Libraries\Mail\MailQueue;
use App\Libraries\Mail\MailRenderer;
use App\Libraries\Mail\MailSamples;
use App\Libraries\Mail\MailText;
use App\Libraries\Mail\MailUrls;
use App\Libraries\Mail\UnsubscribeToken;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * The email building blocks: unsubscribe tokens, texts and plurals, the
 * templates, the plain-text part, retry and bounce rules. No database, no SMTP.
 *
 * @internal
 */
final class MailTest extends CIUnitTestCase
{
    // -------------------------------------------------------------------------
    // Unsubscribe tokens
    // -------------------------------------------------------------------------

    public function testTokenRoundTrip(): void
    {
        $tokens = new UnsubscribeToken('secret');
        $token  = $tokens->create('65cfa7cc34b74', 'comment');

        $this->assertSame(['userId' => '65cfa7cc34b74', 'type' => 'comment'], $tokens->parse($token));
    }

    public function testForgedTokensAreRejected(): void
    {
        $tokens = new UnsubscribeToken('secret');
        $token  = $tokens->create('65cfa7cc34b74', 'comment');
        [$user, , $signature] = explode('.', $token);

        $this->assertNull($tokens->parse($user . '.all.' . $signature), 'another scope with the same signature');
        $this->assertNull($tokens->parse('65cfa7cc34b75.comment.' . $signature), 'another user with the same signature');
        $this->assertNull((new UnsubscribeToken('other'))->parse($token), 'another secret');
        $this->assertNull($tokens->parse(null));
        $this->assertNull($tokens->parse(''));
        $this->assertNull($tokens->parse('garbage'));
        $this->assertNull($tokens->parse($token . "'"));
    }

    public function testTokenIsUrlSafe(): void
    {
        $token = (new UnsubscribeToken('secret'))->create('abc', 'digest');

        $this->assertSame($token, rawurlencode($token));
    }

    // -------------------------------------------------------------------------
    // Texts
    // -------------------------------------------------------------------------

    public function testRussianPlurals(): void
    {
        $cases = [1 => 0, 2 => 1, 4 => 1, 5 => 2, 11 => 2, 12 => 2, 14 => 2, 21 => 0, 22 => 1, 25 => 2, 101 => 0, 111 => 2, 0 => 2];

        foreach ($cases as $count => $index) {
            $this->assertSame($index, MailText::pluralIndex('ru', $count), (string) $count);
        }

        $this->assertSame('1 оценка', MailText::plural('ru', 'digestRatings', 1));
        $this->assertSame('3 оценки', MailText::plural('ru', 'digestRatings', 3));
        $this->assertSame('11 оценок', MailText::plural('ru', 'digestRatings', 11));
    }

    public function testEnglishPlurals(): void
    {
        $this->assertSame('1 rating', MailText::plural('en', 'digestRatings', 1));
        $this->assertSame('2 ratings', MailText::plural('en', 'digestRatings', 2));
        $this->assertSame('0 ratings', MailText::plural('en', 'digestRatings', 0));
    }

    public function testPlaceholdersAndUnknownLocale(): void
    {
        $this->assertSame('Hi, Ann!', MailText::get('en', 'greeting', ['name' => 'Ann']));
        $this->assertSame('ru', MailText::locale('de'));
        $this->assertSame('ru', MailText::locale(null));
    }

    public function testBothLocalesHaveTheSameKeys(): void
    {
        $ru = require APPPATH . 'Language/ru/Emails.php';
        $en = require APPPATH . 'Language/en/Emails.php';

        $this->assertSame([], array_diff(array_keys($ru), array_keys($en)), 'missing in en');
        $this->assertSame([], array_diff(array_keys($en), array_keys($ru)), 'missing in ru');
    }

    // -------------------------------------------------------------------------
    // URLs
    // -------------------------------------------------------------------------

    public function testEnglishLinksGetTheLocalePrefix(): void
    {
        $this->assertStringEndsWith('/en/places/abc-slug', MailUrls::place('en', 'abc', 'slug'));
        $this->assertStringNotContainsString('/en/', MailUrls::place('ru', 'abc', 'slug'));
        $this->assertStringEndsWith('/en/unsubscribe?token=a.b.c', MailUrls::unsubscribePage('en', 'a.b.c'));
        $this->assertStringContainsString('/mail/unsubscribe?token=a.b.c', MailUrls::oneClickUnsubscribe('a.b.c'));
    }

    // -------------------------------------------------------------------------
    // Activity emails
    // -------------------------------------------------------------------------

    private function event(string $type, string $title, array $extra = []): array
    {
        return $extra + [
            'activityId' => 'a-' . $type,
            'type'       => $type,
            'placeId'    => 'p-' . md5($title),
            'slug'       => null,
            'title'      => $title,
            'hasCover'   => false,
            'actor'      => 'traveler42',
            'comment'    => null,
            'rating'     => null,
        ];
    }

    public function testSingleEventSubjectNamesThePlace(): void
    {
        $result = ActivityMail::render([$this->event('comment', 'Водопад', ['comment' => 'Круто'])], 'Ann', 'ru');

        $this->assertSame('Новый комментарий к месту «Водопад»', $result['subject']);
        $this->assertStringContainsString('Круто', $result['html']);
        $this->assertStringContainsString('Открыть место', $result['text']);
    }

    public function testSeveralEventsAreGroupedIntoOneEmail(): void
    {
        $result = ActivityMail::render([
            $this->event('comment', 'Водопад'),
            $this->event('rating', 'Водопад', ['rating' => 5]),
            $this->event('photo', 'Пещера'),
        ], 'Ann', 'ru');

        $this->assertSame('На ваших местах 3 новых события', $result['subject']);
        $this->assertSame(1, substr_count($result['text'], 'Водопад ('), 'one block per place');
        $this->assertStringContainsString('Пещера', $result['text']);
    }

    public function testRepeatedActionsOfOnePersonAreOneLine(): void
    {
        $result = ActivityMail::render([
            $this->event('edit', 'Водопад', ['actor' => 'Сергей']),
            $this->event('edit', 'Водопад', ['actor' => 'Сергей']),
            $this->event('cover', 'Водопад', ['actor' => 'Дима']),
            $this->event('edit', 'Водопад', ['actor' => 'Сергей']),
            $this->event('edit', 'Водопад', ['actor' => 'Дима']),
            $this->event('comment', 'Водопад', ['actor' => 'Сергей', 'comment' => 'Раз']),
            $this->event('comment', 'Водопад', ['actor' => 'Сергей', 'comment' => 'Два']),
        ], 'Ann', 'ru');

        $this->assertSame('На ваших местах 7 новых событий', $result['subject']);
        $this->assertSame(1, substr_count($result['html'], 'Правка описания · Сергей'));
        $this->assertStringContainsString('Правка описания · Сергей · ×3', $result['html']);
        $this->assertStringContainsString('Правка описания · Дима', $result['html']);
        $this->assertSame(2, substr_count($result['html'], 'Новый комментарий · Сергей'), 'comments stay apart');
    }

    public function testUserTextIsEscaped(): void
    {
        $result = ActivityMail::render([
            $this->event('comment', '<b>Place</b> \'quoted\'', ['comment' => '<script>alert(1)</script>', 'actor' => '<img src=x>']),
        ], '<i>Ann</i>', 'en');

        $this->assertStringNotContainsString('<script>', $result['html']);
        $this->assertStringNotContainsString('<b>Place</b>', $result['html']);
        $this->assertStringNotContainsString('<img src=x>', $result['html']);
        $this->assertStringNotContainsString('<i>Ann</i>', $result['html']);
        $this->assertStringContainsString('&lt;script&gt;', $result['html']);
    }

    public function testGuestActor(): void
    {
        $result = ActivityMail::render([$this->event('visit', 'Place', ['actor' => null])], 'Ann', 'en');

        $this->assertStringContainsString('A guest', $result['text']);
    }

    public function testUnsubscribeScopeOfAnEmail(): void
    {
        $this->assertSame('comment', ActivityMail::unsubscribeType([$this->event('comment', 'A'), $this->event('comment', 'B')]));
        $this->assertSame('activity', ActivityMail::unsubscribeType([$this->event('comment', 'A'), $this->event('photo', 'B')]));
    }

    // -------------------------------------------------------------------------
    // Weekly digest
    // -------------------------------------------------------------------------

    private function story(string $type, string $author, int $weight, array $extra = []): array
    {
        return $extra + ['type' => $type, 'weight' => $weight, 'author' => ['id' => $author, 'name' => $author]];
    }

    public function testHighlightsPreferProminentStoriesAndLimitEachPerson(): void
    {
        $picked = DigestService::pickHighlights([
            $this->story('comment', 'ann', 2),
            $this->story('rating', 'bob', 1),
            $this->story('place', 'ann', 3),
            $this->story('photo', 'ann', 3),
            $this->story('collection', 'ann', 3),
            $this->story('achievement', 'bob', 2),
        ], 5, 2);

        $this->assertSame(['place', 'photo', 'achievement'], array_column($picked, 'type'), 'weight first, feed order within a weight, two per person, no ratings');
    }

    public function testDigestSubjectTellsThePersonalNews(): void
    {
        $views  = ['place_activity' => [['views' => 3, 'ratings' => 1], ['views' => 2]]];
        $events = ['place_activity' => [['views' => 0, 'ratings' => 1, 'comments' => 2]]];

        $this->assertSame('Ваши места посмотрели 5 раз за неделю', DigestMail::subject('ru', $views));
        $this->assertSame('Your places were viewed 5 times this week', DigestMail::subject('en', $views));
        $this->assertSame('На ваших местах 3 новых события за неделю', DigestMail::subject('ru', $events));
        $this->assertSame('Ваша неделя на Геометках', DigestMail::subject('ru', []));
    }

    public function testHighlightOfAStory(): void
    {
        $place = ['id' => 'p1', 'slug' => 'gora', 'title' => 'Гора', 'cover' => ['preview' => 'uploads/places/p1/cover_preview.jpg']];

        $photo = DigestMail::highlight($this->story('photo', 'ann', 3, [
            'place' => $place, 'photosCount' => 3, 'photos' => [['preview' => 'uploads/places/p1/x_preview.webp']],
        ]), 'ru');
        $this->assertSame('3 новых фото', $photo['label']);
        $this->assertStringEndsWith('/uploads/places/p1/cover_preview.jpg', $photo['image'], 'WebP falls back to the JPEG cover');
        $this->assertStringEndsWith('/places/p1-gora', $photo['url']);

        $comment = DigestMail::highlight($this->story('comment', 'ann', 2, [
            'place' => $place, 'comment' => ['content' => str_repeat('a', 300)],
        ]), 'en');
        $this->assertSame(160, mb_strlen($comment['quote']));

        $level = DigestMail::highlight($this->story('level', 'ann', 2, ['level' => 7]), 'en');
        $this->assertSame('Level 7', $level['title']);
        $this->assertTrue($level['square']);

        $this->assertNull(DigestMail::highlight($this->story('rating', 'ann', 1), 'ru'));
        $this->assertNull(DigestMail::highlight($this->story('place', 'ann', 3), 'ru'), 'a place story without its place');
    }

    public function testUploadUrls(): void
    {
        $this->assertStringEndsWith('/uploads/users/u1/a.png', MailUrls::upload('uploads/users/u1/a.png'));
        $this->assertSame('https://cdn.test/a.png', MailUrls::upload('https://cdn.test/a.png'));
    }

    public function testApiLinksWithoutBaseUrlPointToProductionNotLocalhost(): void
    {
        $names = ['app.baseURL', 'mail.imageHost'];
        $saved = [];

        foreach ($names as $name) {
            $saved[$name] = [getenv($name), $_ENV[$name] ?? null, $_SERVER[$name] ?? null];
            putenv($name);
            unset($_ENV[$name], $_SERVER[$name]);
        }

        try {
            $this->assertSame('https://api.geometki.com/uploads/places/p1/cover_preview.jpg', MailUrls::placeCover('p1'));
            $this->assertStringStartsWith('https://api.geometki.com/mail/unsubscribe', MailUrls::oneClickUnsubscribe('a.b.c'));
        } finally {
            foreach ($saved as $name => [$process, $env, $server]) {
                if ($process !== false) {
                    putenv($name . '=' . $process);
                }
                if ($env !== null) {
                    $_ENV[$name] = $env;
                }
                if ($server !== null) {
                    $_SERVER[$name] = $server;
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Layout and plain text
    // -------------------------------------------------------------------------

    public function testEveryKindRendersInBothLocales(): void
    {
        foreach (['ru', 'en'] as $locale) {
            foreach (MailSamples::KINDS as $kind) {
                $message = MailSamples::build($kind, 'to@example.com', $locale);

                $this->assertStringContainsString('<html lang="' . $locale . '"', $message->html, "{$kind} {$locale}");
                $this->assertStringContainsString('</html>', $message->html);
                $this->assertNotSame('', trim($message->text));
                $this->assertStringNotContainsString('<', $message->text, "{$kind} {$locale}: tags in the text part");
                $this->assertDoesNotMatchRegularExpression('/\{[a-z]+\}/i', $message->subject . $message->html, 'an unreplaced placeholder');
            }
        }
    }

    public function testSignInEmailHasNoUnsubscribe(): void
    {
        $message = MailSamples::build('magic-link', 'to@example.com', 'ru');

        $this->assertNull($message->unsubscribeUrl);
        $this->assertStringNotContainsString('unsubscribe', $message->html);
        $this->assertStringContainsString('/auth?token=sample-token', $message->text);
    }

    public function testNotificationsHaveUnsubscribeAndSettings(): void
    {
        foreach (['activity', 'activity-group', 'digest'] as $kind) {
            $message = MailSamples::build($kind, 'to@example.com', 'en');

            $this->assertNotNull($message->unsubscribeUrl, $kind);
            $this->assertStringContainsString('/en/unsubscribe?token=', $message->html, $kind);
            $this->assertStringContainsString('/en/users/settings', $message->html, $kind);
        }
    }

    public function testToTextKeepsLinksAndDropsStylesAndPreheader(): void
    {
        $html = '<html><head><style>p{color:red}</style></head><body>'
            . '<div class="gm-preheader">hidden preview</div>'
            . "<p>Hello\n   <b>world</b></p><p><a href=\"https://x.test/a?b=1&amp;c=2\">Open</a></p>"
            . '<p><a href="https://x.test">https://x.test</a></p></body></html>';

        $text = MailRenderer::toText($html);

        $this->assertStringNotContainsString('color:red', $text);
        $this->assertStringNotContainsString('hidden preview', $text);
        $this->assertStringContainsString('Hello world', $text);
        $this->assertStringContainsString('Open (https://x.test/a?b=1&c=2)', $text);
        $this->assertStringContainsString("\nhttps://x.test\n", $text);
    }

    // -------------------------------------------------------------------------
    // Delivery rules
    // -------------------------------------------------------------------------

    public function testDigestBudgetKeepsWithinTheHostingLimits(): void
    {
        $config = new \Config\Notifications();
        $config->batchSize       = 100;
        $config->digestHourLimit = 500;
        $config->digestDayLimit  = 2000;

        $this->assertSame(100, MailQueue::digestBudget($config, 0, 0), 'a run sends at most a batch');
        $this->assertSame(20, MailQueue::digestBudget($config, 480, 480), 'what is left of the hour');
        $this->assertSame(5, MailQueue::digestBudget($config, 0, 1995), 'what is left of the day');
        $this->assertSame(0, MailQueue::digestBudget($config, 500, 500), 'the hour is used up: wait');
        $this->assertSame(0, MailQueue::digestBudget($config, 0, 2100), 'over the day: wait, never negative');
    }

    public function testRetryBacksOffAndGivesUp(): void
    {
        $this->assertSame(5, MailQueue::retryDelayMinutes(1, 4, 5));
        $this->assertSame(10, MailQueue::retryDelayMinutes(2, 4, 5));
        $this->assertSame(20, MailQueue::retryDelayMinutes(3, 4, 5));
        $this->assertNull(MailQueue::retryDelayMinutes(4, 4, 5));
        $this->assertNull(MailQueue::retryDelayMinutes(1, 4, 5, true), 'an undeliverable address is not retried');
    }

    public function testPermanentFailureDetection(): void
    {
        // The recipient mailbox, in the reply to RCPT TO
        $this->assertTrue(Mailer::isPermanent("from: 250 OK\nto: 550 5.1.1 <x@y.z>: Recipient address rejected: User unknown"));
        $this->assertTrue(Mailer::isPermanent("to: 550 5.1.2 Host unknown"));
        $this->assertTrue(Mailer::isPermanent("to: 553 5.1.3 Bad recipient address syntax"));
        $this->assertTrue(Mailer::isPermanent("to: 550 Message was not accepted -- no such user"));
        $this->assertTrue(Mailer::isPermanent("to: 550 5.7.1 No such user!"), 'Yandex: an unknown mailbox under a policy code');

        // Not about the recipient: the sender, policy, spam, temporary, connection
        $this->assertFalse(Mailer::isPermanent("from: 553 5.1.8 Sender address rejected: not owned by user"), 'sender at MAIL FROM');
        $this->assertFalse(Mailer::isPermanent("from: 550 5.1.8 Access denied, bad sender domain"));
        $this->assertFalse(Mailer::isPermanent("to: 553 5.1.8 Sender address rejected"), '5.1.8 is a sender code even at RCPT');
        $this->assertFalse(Mailer::isPermanent("to: 550 5.7.1 Relay access denied, domain not found in whitelist"));
        $this->assertFalse(Mailer::isPermanent("from: 550 Spam message rejected; sender not found in allow list"));
        $this->assertFalse(Mailer::isPermanent("data: 550 5.7.1 Message rejected as spam"));
        $this->assertFalse(Mailer::isPermanent("to: 450 4.2.0 Mailbox busy"));
        $this->assertFalse(Mailer::isPermanent("Unable to connect to the SMTP server"));
        $this->assertFalse(Mailer::isPermanent("The following SMTP error was encountered: 550 5.1.1 User unknown"), 'only the RCPT line counts');
    }
}
