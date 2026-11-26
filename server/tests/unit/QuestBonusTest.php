<?php

namespace Tests\Unit;

use App\Libraries\QuestsLibrary;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * The experience of a quest walked to the end: MODIFIER_QUEST_POINT a point, at least
 * MODIFIER_QUEST_MIN (QuestsLibrary::bonusOf()).
 *
 * @internal
 */
final class QuestBonusTest extends CIUnitTestCase
{
    public function testAShortQuestGivesTheMinimum(): void
    {
        $this->assertSame(100, QuestsLibrary::bonusOf(2));
        $this->assertSame(100, QuestsLibrary::bonusOf(5));
    }

    public function testALongerQuestGivesTwentyAPoint(): void
    {
        $this->assertSame(120, QuestsLibrary::bonusOf(6));
        $this->assertSame(300, QuestsLibrary::bonusOf(15));
    }
}
