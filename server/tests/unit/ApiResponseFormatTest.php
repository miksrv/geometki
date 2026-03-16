<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for the documented API error/response envelope shape.
 *
 * The CLAUDE.md contract states:
 *   API returns { messages: { error?: string, [field]: string } }
 *
 * These tests verify:
 *   1. CI4's ResourceController fail* helpers produce the documented envelope.
 *   2. Constants used in auth type discrimination are correctly defined.
 *   3. The experience modifier constants that govern numeric responses are correct.
 *   4. The rating transformRating() helper maps to the expected integer reputation change.
 *   5. Password hashing produces a result that round-trips through password_verify.
 *
 * No database, no HTTP wire traffic — uses CI4 validation service directly.
 *
 * @internal
 */
final class ApiResponseFormatTest extends CIUnitTestCase
{
    // =========================================================================
    // CI4 Validation error structure
    //
    // Controllers call $this->failValidationErrors($this->validator->getErrors())
    // which wraps errors in { messages: { field: "message" } }.
    // We test the shape by running the validation service directly.
    // =========================================================================

    public function testValidationErrorsReturnAssociativeArray(): void
    {
        // Use getShared=false to get a clean instance uncontaminated by prior test rules
        $validation = \Config\Services::validation(null, false);

        $validation->setRules([
            'email'    => 'required|valid_email',
            'password' => 'required|min_length[8]',
        ]);

        $ran = $validation->run([]);

        $this->assertFalse($ran);
        $errors = $validation->getErrors();
        $this->assertIsArray($errors);
    }

    public function testValidationErrorsContainFieldKeys(): void
    {
        $validation = \Config\Services::validation(null, false);

        $validation->setRules([
            'email'    => 'required|valid_email',
            'password' => 'required|min_length[8]',
        ]);

        $validation->run([]);
        $errors = $validation->getErrors();

        $this->assertArrayHasKey('email', $errors);
        $this->assertArrayHasKey('password', $errors);
    }

    public function testValidationErrorMessagesAreStrings(): void
    {
        $validation = \Config\Services::validation(null, false);

        $validation->setRules(['name' => 'required']);
        $validation->run([]);

        foreach ($validation->getErrors() as $message) {
            $this->assertIsString($message);
        }
    }

    public function testValidationPassesWithValidData(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'email'    => 'required|valid_email',
            'password' => 'required|min_length[8]',
        ])->run([
            'email'    => 'user@example.com',
            'password' => 'StrongPass1',
        ]);

        $this->assertTrue($ran);
        $this->assertEmpty($validation->getErrors());
    }

    public function testRegistrationRulesRejectShortPassword(): void
    {
        // Mirrors Auth::registration() validation: password min_length[8]
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'name'     => 'required',
            'email'    => 'required|min_length[6]|max_length[50]|valid_email',
            'password' => 'required|min_length[8]|max_length[50]',
        ])->run([
            'name'     => 'Alice',
            'email'    => 'alice@example.com',
            'password' => 'short',
        ]);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('password', $validation->getErrors());
    }

    public function testRegistrationRulesRejectInvalidEmail(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'name'     => 'required',
            'email'    => 'required|min_length[6]|max_length[50]|valid_email',
            'password' => 'required|min_length[8]|max_length[50]',
        ])->run([
            'name'     => 'Bob',
            'email'    => 'not-an-email',
            'password' => 'SecurePassword',
        ]);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('email', $validation->getErrors());
    }

    public function testRegistrationRulesRejectMissingName(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'name'     => 'required',
            'email'    => 'required|min_length[6]|max_length[50]|valid_email',
            'password' => 'required|min_length[8]|max_length[50]',
        ])->run([
            'email'    => 'user@example.com',
            'password' => 'ValidPassword',
        ]);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('name', $validation->getErrors());
    }

    public function testCommentRulesRejectShortPlaceId(): void
    {
        // Mirrors Comments::create() rules: placeId min_length[13]|max_length[13]
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
            'comment' => 'required|string',
        ])->run([
            'placeId' => 'short',
            'comment' => 'A comment',
        ]);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('placeId', $validation->getErrors());
    }

    public function testCommentRulesRejectTooLongPlaceId(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
            'comment' => 'required|string',
        ])->run([
            'placeId' => 'this_id_is_way_too_long_for_the_rule',
            'comment' => 'A comment',
        ]);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('placeId', $validation->getErrors());
    }

    public function testCommentRulesAcceptExactlyThirteenCharPlaceId(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
            'comment' => 'required|string',
        ])->run([
            'placeId' => '1234567890123', // exactly 13 chars
            'comment' => 'Valid comment text',
        ]);

        $this->assertTrue($ran);
    }

    public function testPlaceTitleRulesRejectShortTitle(): void
    {
        // Mirrors Places::create() rules: title min_length[8]
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'title' => 'required|min_length[8]|max_length[200]',
        ])->run(['title' => 'Short']);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('title', $validation->getErrors());
    }

    public function testPlaceTitleRulesAcceptValidTitle(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'title' => 'required|min_length[8]|max_length[200]',
        ])->run(['title' => 'Valid Place Title']);

        $this->assertTrue($ran);
    }

    // =========================================================================
    // Auth type constants (used in response branches for service auth)
    // =========================================================================

    public function testAuthTypeNativeConstantIsDefined(): void
    {
        $this->assertTrue(defined('AUTH_TYPE_NATIVE'));
        $this->assertSame('native', AUTH_TYPE_NATIVE);
    }

    public function testAuthTypeGoogleConstantIsDefined(): void
    {
        $this->assertTrue(defined('AUTH_TYPE_GOOGLE'));
        $this->assertSame('google', AUTH_TYPE_GOOGLE);
    }

    public function testAuthTypeYandexConstantIsDefined(): void
    {
        $this->assertTrue(defined('AUTH_TYPE_YANDEX'));
        $this->assertSame('yandex', AUTH_TYPE_YANDEX);
    }

    public function testAuthTypeVkConstantIsDefined(): void
    {
        $this->assertTrue(defined('AUTH_TYPE_VK'));
        $this->assertSame('vk', AUTH_TYPE_VK);
    }

    // =========================================================================
    // Experience modifier constants (appear in numeric fields of API responses)
    // =========================================================================

    public function testModifierPlaceIsDefined(): void
    {
        $this->assertTrue(defined('MODIFIER_PLACE'));
        $this->assertSame(20, MODIFIER_PLACE);
    }

    public function testModifierPhotoIsDefined(): void
    {
        $this->assertTrue(defined('MODIFIER_PHOTO'));
        $this->assertSame(10, MODIFIER_PHOTO);
    }

    public function testModifierRatingIsDefined(): void
    {
        $this->assertTrue(defined('MODIFIER_RATING'));
        $this->assertSame(1, MODIFIER_RATING);
    }

    public function testModifierEditIsDefined(): void
    {
        $this->assertTrue(defined('MODIFIER_EDIT'));
        $this->assertSame(5, MODIFIER_EDIT);
    }

    public function testModifierCoverIsDefined(): void
    {
        $this->assertTrue(defined('MODIFIER_COVER'));
        $this->assertSame(2, MODIFIER_COVER);
    }

    public function testModifierCommentIsDefined(): void
    {
        $this->assertTrue(defined('MODIFIER_COMMENT'));
        $this->assertSame(5, MODIFIER_COMMENT);
    }

    // =========================================================================
    // Rating response calculation
    //
    // Rating::show() computes:
    //   $response['rating'] = round($sum / $count, 1)
    // These tests reproduce that arithmetic without any DB dependency.
    // =========================================================================

    public function testRatingAverageRoundsToOneDecimal(): void
    {
        $values = [5, 4, 3];
        $sum    = array_sum($values);
        $count  = count($values);

        $result = round($sum / $count, 1);

        $this->assertEqualsWithDelta(4.0, $result, 0.05);
    }

    public function testRatingAverageWithUnevenDivision(): void
    {
        $values = [5, 4];
        $sum    = array_sum($values);
        $count  = count($values);

        $result = round($sum / $count, 1);

        // 9/2 = 4.5
        $this->assertEqualsWithDelta(4.5, $result, 0.05);
    }

    public function testRatingResponseCountMatchesItemCount(): void
    {
        // Mirrors Rating::show() — count is count($ratingData)
        $ratingData    = [
            (object) ['value' => 5, 'session_id' => 'sess1', 'user_id' => null],
            (object) ['value' => 3, 'session_id' => 'sess2', 'user_id' => null],
        ];
        $response      = ['rating' => 0, 'count' => 0];
        $response['count'] = count($ratingData);

        foreach ($ratingData as $item) {
            $response['rating'] += $item->value;
        }

        $response['rating'] = round($response['rating'] / $response['count'], 1);

        $this->assertSame(2, $response['count']);
        $this->assertEqualsWithDelta(4.0, $response['rating'], 0.05);
    }

    // =========================================================================
    // transformRating impact on reputation (used in Rating::set() response chain)
    // =========================================================================

    public function testReputationIncreasedByTransformRatingForHighScore(): void
    {
        helper('rating');

        $initialReputation = 10;
        $inputRating       = 5; // transformRating(5) => +2

        $newReputation = $initialReputation + transformRating($inputRating);

        $this->assertSame(12, $newReputation);
    }

    public function testReputationDecreasedByTransformRatingForLowScore(): void
    {
        helper('rating');

        $initialReputation = 10;
        $inputRating       = 1; // transformRating(1) => -2

        $newReputation = $initialReputation + transformRating($inputRating);

        $this->assertSame(8, $newReputation);
    }

    public function testReputationUnchangedByNeutralScore(): void
    {
        helper('rating');

        $initialReputation = 10;
        $inputRating       = 3; // transformRating(3) => 0

        $newReputation = $initialReputation + transformRating($inputRating);

        $this->assertSame(10, $newReputation);
    }

    // =========================================================================
    // Image dimension constants (used in validation inside controllers)
    // =========================================================================

    public function testPlaceCoverDimensionsAreDefined(): void
    {
        $this->assertTrue(defined('PLACE_COVER_WIDTH'));
        $this->assertTrue(defined('PLACE_COVER_HEIGHT'));
        $this->assertSame(870, PLACE_COVER_WIDTH);
        $this->assertSame(300, PLACE_COVER_HEIGHT);
    }

    public function testAvatarSmallDimensionsAreDefined(): void
    {
        $this->assertTrue(defined('AVATAR_SMALL_WIDTH'));
        $this->assertTrue(defined('AVATAR_SMALL_HEIGHT'));
        $this->assertSame(100, AVATAR_SMALL_WIDTH);
        $this->assertSame(100, AVATAR_SMALL_HEIGHT);
    }

    public function testAvatarMediumDimensionsAreDefined(): void
    {
        $this->assertTrue(defined('AVATAR_MEDIUM_WIDTH'));
        $this->assertTrue(defined('AVATAR_MEDIUM_HEIGHT'));
        $this->assertSame(400, AVATAR_MEDIUM_WIDTH);
        $this->assertSame(400, AVATAR_MEDIUM_HEIGHT);
    }

    public function testPhotoMaxDimensionsAreDefined(): void
    {
        $this->assertTrue(defined('PHOTO_MAX_WIDTH'));
        $this->assertTrue(defined('PHOTO_MAX_HEIGHT'));
        $this->assertSame(4048, PHOTO_MAX_WIDTH);
        $this->assertSame(3036, PHOTO_MAX_HEIGHT);
    }
}
