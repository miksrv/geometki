<?php

use App\Libraries\PlaceInput;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * The cleaning and the checks of the place form's input (POST /places, PATCH /places/:id).
 * The rules run through the real validator, as Places::readPlaceInput() runs them.
 *
 * @internal
 */
final class PlaceInputTest extends CIUnitTestCase
{
    /** @return array<string, string> the errors, empty when the input is valid */
    private function check(array $input, bool $create = true): array
    {
        $data      = PlaceInput::sanitize((object) $input);
        $validator = service('validation', null, false);
        $validator->setRules(PlaceInput::rules($create), PlaceInput::messages());
        $validator->run($data);

        return array_merge($validator->getErrors(), PlaceInput::errors($data, $create));
    }

    private function valid(array $overrides = []): array
    {
        return array_merge([
            'title'    => 'Водопад Девичьи слёзы',
            'category' => 'waterfall',
            'lat'      => 55.755826,
            'lon'      => 37.6173,
            'content'  => 'Своими словами о **месте**.',
        ], $overrides);
    }

    public function testAValidPlacePasses(): void
    {
        $this->assertSame([], $this->check($this->valid()));
    }

    public function testTheTitleIsCleanedBeforeItsLengthIsChecked(): void
    {
        // Eight and more characters of tags are no title once they are stripped
        $this->assertArrayHasKey('title', $this->check($this->valid(['title' => '<b></b><i></i><script></script>'])));
        $this->assertArrayHasKey('title', $this->check($this->valid(['title' => '   Озеро     '])));

        $data = PlaceInput::sanitize((object) ['title' => '  <b>Озеро</b> &laquo;Голубое&raquo; ']);
        $this->assertSame('Озеро «Голубое»', $data['title']);
    }

    public function testTheTitleLimits(): void
    {
        $this->assertArrayHasKey('title', $this->check($this->valid(['title' => 'Озеро'])));
        $this->assertArrayHasKey('title', $this->check($this->valid(['title' => str_repeat('я', 201)])));
        $this->assertSame([], $this->check($this->valid(['title' => str_repeat('я', 200)])));
    }

    public function testAFieldOfAnotherTypeIsAnErrorNotACrash(): void
    {
        $errors = $this->check($this->valid(['title' => ['x'], 'content' => ['y'], 'category' => ['waterfall']]));

        $this->assertArrayHasKey('title', $errors);
        $this->assertArrayHasKey('content', $errors);
        $this->assertArrayHasKey('category', $errors);
        $this->assertArrayHasKey('photos', $this->check($this->valid(['photos' => 'a.jpg'])));
    }

    public function testAnUnknownCategoryIsRefused(): void
    {
        $this->assertArrayHasKey('category', $this->check($this->valid(['category' => 'casino'])));
    }

    public function testTheCoordinatesAreRequiredOnCreateOnly(): void
    {
        $input = $this->valid();
        unset($input['lat'], $input['lon']);

        $this->assertArrayHasKey('lat', $this->check($input));
        $this->assertArrayHasKey('lon', $this->check($input));
        $this->assertSame([], $this->check(['content' => 'Только описание'], false));
    }

    public function testTheCoordinatesAreOnTheGlobe(): void
    {
        $this->assertArrayHasKey('lat', $this->check($this->valid(['lat' => 91])));
        $this->assertArrayHasKey('lon', $this->check($this->valid(['lon' => -180.5])));
        $this->assertArrayHasKey('lat', $this->check($this->valid(['lat' => 'north'])));
        $this->assertArrayHasKey('lat', $this->check($this->valid(['lat' => [55]])));
        $this->assertArrayHasKey('lat', $this->check($this->valid(['lat' => true])));

        // An integer, a numeric string and a tiny float (`1.0E-5` as a string) are all fine
        $this->assertSame([], $this->check($this->valid(['lat' => 55, 'lon' => '37.6173'])));
        $this->assertSame([], $this->check($this->valid(['lat' => 0.00001, 'lon' => -0.00001])));
    }

    public function testTheDescriptionLimits(): void
    {
        $this->assertSame([], $this->check($this->valid(['content' => ''])));
        $this->assertSame([], $this->check($this->valid(['content' => str_repeat('я', PlaceInput::CONTENT_MAX)])));
        $this->assertArrayHasKey('content', $this->check($this->valid(['content' => str_repeat('я', PlaceInput::CONTENT_MAX + 1)])));

        // Within the characters, beyond the bytes of the TEXT column: four-byte emoji
        $this->assertArrayHasKey('content', $this->check($this->valid(['content' => str_repeat('🙂', 17000)])));
    }

    public function testTheDescriptionKeepsItsMarkdownAndLosesItsHtml(): void
    {
        $data = PlaceInput::sanitize((object) ['content' => "# Заголовок\n\n<script>alert(1)</script>**жирный** [ссылка](https://example.com)"]);

        $this->assertSame("# Заголовок\n\nalert(1)**жирный** [ссылка](https://example.com)", $data['content']);
    }

    public function testAnEmptyBodyIsRefused(): void
    {
        $data = PlaceInput::sanitize(null);

        $this->assertSame([], $data);
        $this->assertArrayHasKey('lat', PlaceInput::errors($data, true));
    }
}
