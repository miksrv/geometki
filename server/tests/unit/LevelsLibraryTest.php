<?php

use App\Entities\UserEntity;
use App\Libraries\LevelsLibrary;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for LevelsLibrary::getLevelData(): the level with where it starts and where the
 * next one starts. Pure logic over Config\Levels — no DB.
 *
 * @internal
 */
final class LevelsLibraryTest extends CIUnitTestCase
{
    private function user(int $level, int $experience): UserEntity
    {
        return new UserEntity(['id' => 'u1', 'level' => $level, 'experience' => $experience]);
    }

    public function testGivesTheStartOfTheLevelAndOfTheNextOne(): void
    {
        $data = (new LevelsLibrary())->getLevelData($this->user(15, 6796));

        $this->assertSame(15, $data->level);
        $this->assertSame(6796, $data->experience);
        $this->assertSame(6600, $data->levelExperience);
        $this->assertSame(8000, $data->nextLevel);
    }

    public function testTheLastLevelHasNoNextOne(): void
    {
        $data = (new LevelsLibrary())->getLevelData($this->user(30, 48210));

        $this->assertSame(47500, $data->levelExperience);
        $this->assertNull($data->nextLevel);
    }

    public function testOneUserDoesNotChangeTheLevelOfTheNext(): void
    {
        $library = new LevelsLibrary();

        $library->getLevelData($this->user(5, 700));
        $data = $library->getLevelData($this->user(5, 510));

        $this->assertSame(510, $data->experience);
        $this->assertSame(500, $data->levelExperience);
        $this->assertSame(750, $data->nextLevel);
    }

    public function testAnUnknownLevelGivesNull(): void
    {
        $this->assertNull((new LevelsLibrary())->getLevelData($this->user(99, 100000)));
    }
}
