<?php

use App\Libraries\AdminImageLibrary;
use App\Libraries\GameLibrary;
use CodeIgniter\Test\CIUnitTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * The pictures of the admin pages: what an SVG may hold, which stored paths are the folder's own,
 * and the game's day.
 *
 * @internal
 */
final class AdminImageLibraryTest extends CIUnitTestCase
{
    public function testAPlainSvgIsSafeWithOrWithoutTheXmlPrologue(): void
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><circle cx="5" cy="5" r="4" fill="url(#g)"/><use href="#g"/></svg>';

        $this->assertTrue(AdminImageLibrary::isSafeSvg($svg));
        $this->assertTrue(AdminImageLibrary::isSafeSvg('<?xml version="1.0"?>' . "\n" . $svg));
    }

    #[DataProvider('unsafe')]
    public function testAnSvgThatRunsOrReachesOutIsRefused(string $svg): void
    {
        $this->assertFalse(AdminImageLibrary::isSafeSvg($svg));
    }

    /** @return array<string, array{string}> */
    public static function unsafe(): array
    {
        $wrap = static fn (string $inner) => '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' . $inner . '</svg>';

        return [
            'script'            => [$wrap('<script>alert(1)</script>')],
            'script upper'      => [$wrap('<SCRIPT>alert(1)</SCRIPT>')],
            'handler'           => [$wrap('<circle onload="alert(1)" r="1"/>')],
            'handler on click'  => [$wrap('<a onclick = "x()"><circle r="1"/></a>')],
            'foreignObject'     => [$wrap('<foreignObject><div>hi</div></foreignObject>')],
            'javascript link'   => [$wrap('<a href="javascript:alert(1)"><circle r="1"/></a>')],
            'entity javascript' => [$wrap('<a href="&#106;avascript:alert(1)"><circle r="1"/></a>')],
            'external href'     => [$wrap('<image href="https://evil.example/a.png"/>')],
            'external xlink'    => [$wrap('<image xlink:href="//evil.example/a.png"/>')],
            'data href'         => [$wrap('<image href="data:image/svg+xml;base64,AAAA"/>')],
            'style import'      => [$wrap('<style>@import url(https://evil.example/x.css);</style>')],
            'style url'         => [$wrap('<circle style="fill:url(https://evil.example/x)" r="1"/>')],
            'doctype entity'    => ['<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>'],
            'not xml'           => ['<svg><circle></svg>'],
            'not svg'           => ['<html><body>hi</body></html>'],
            'iframe'            => [$wrap('<iframe src="x"/>')],
        ];
    }

    public function testOnlyAFileOfTheFolderIsItsOwnPath(): void
    {
        $this->assertTrue(AdminImageLibrary::isOwnPath('uploads/achievements/a1_1700000000_ab12.png', 'achievements'));
        $this->assertFalse(AdminImageLibrary::isOwnPath('uploads/seasons/a.png', 'achievements'));
        $this->assertFalse(AdminImageLibrary::isOwnPath('uploads/achievements/../../.env', 'achievements'));
        $this->assertFalse(AdminImageLibrary::isOwnPath('uploads/achievements/..', 'achievements'));
        $this->assertFalse(AdminImageLibrary::isOwnPath('uploads/achievements/sub/a.png', 'achievements'));
        $this->assertFalse(AdminImageLibrary::isOwnPath('/etc/passwd', 'achievements'));
        $this->assertFalse(AdminImageLibrary::isOwnPath(null, 'achievements'));
    }

    public function testTheGamesDayIsAMoscowDay(): void
    {
        // 20:59:59 UTC is 23:59:59 in Moscow, a second later it is the next day there
        $this->assertSame('2026-11-15', GameLibrary::today(strtotime('2026-11-15 20:59:59 UTC')));
        $this->assertSame('2026-11-16', GameLibrary::today(strtotime('2026-11-15 21:00:00 UTC')));
        $this->assertSame('2026-11-17', GameLibrary::today(strtotime('2026-11-15 21:00:00 UTC'), 1));
        $this->assertSame('2026-11-14', GameLibrary::today(strtotime('2026-11-15 21:00:00 UTC'), '-2 days'));
        $this->assertSame('2026-11-16', GameLibrary::today(strtotime('2026-11-15 21:00:00 UTC'), 0));
    }
}
