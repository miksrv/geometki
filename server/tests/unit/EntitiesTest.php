<?php

use App\Entities\ActivityEntity;
use App\Entities\CategoryEntity;
use App\Entities\CommentEntity;
use App\Entities\LocationCountryEntity;
use App\Entities\PhotoEntity;
use App\Entities\PlaceContentEntity;
use App\Entities\PlaceEntity;
use App\Entities\RatingEntity;
use App\Entities\SessionEntity;
use App\Entities\TagEntity;
use App\Entities\UserBookmarkEntity;
use App\Entities\UserEntity;
use App\Entities\UserLevelEntity;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for all Entity classes in app/Entities/.
 *
 * No database or HTTP connection required.
 *
 * @internal
 */
final class EntitiesTest extends CIUnitTestCase
{
    // =========================================================================
    // UserEntity
    // =========================================================================

    public function testUserEntityCanBeInstantiated(): void
    {
        $user = new UserEntity();

        $this->assertInstanceOf(UserEntity::class, $user);
    }

    public function testUserEntityDefaultRoleIsUser(): void
    {
        $user = new UserEntity();

        $this->assertSame('user', $user->role);
    }

    public function testUserEntityDefaultAuthTypeIsNative(): void
    {
        $user = new UserEntity();

        $this->assertSame('native', $user->auth_type);
    }

    public function testUserEntityDefaultLocaleIsRu(): void
    {
        $user = new UserEntity();

        $this->assertSame('ru', $user->locale);
    }

    public function testUserEntityDefaultLevelIsOne(): void
    {
        $user = new UserEntity();

        $this->assertSame(1, $user->level);
    }

    public function testUserEntityDefaultExperienceIsZero(): void
    {
        $user = new UserEntity();

        $this->assertSame(0, $user->experience);
    }

    public function testUserEntityDefaultReputationIsZero(): void
    {
        $user = new UserEntity();

        $this->assertSame(0, $user->reputation);
    }

    public function testUserEntityFillSetsName(): void
    {
        $user = new UserEntity();
        $user->fill(['name' => 'Alice']);

        $this->assertSame('Alice', $user->name);
    }

    public function testUserEntityFillSetsEmail(): void
    {
        $user = new UserEntity();
        $user->fill(['email' => 'alice@example.com']);

        $this->assertSame('alice@example.com', $user->email);
    }

    public function testUserEntityLevelCastToInteger(): void
    {
        $user = new UserEntity();
        $user->fill(['level' => '5']);

        $this->assertIsInt($user->level);
        $this->assertSame(5, $user->level);
    }

    public function testUserEntityExperienceCastToInteger(): void
    {
        $user = new UserEntity();
        $user->fill(['experience' => '100']);

        $this->assertIsInt($user->experience);
        $this->assertSame(100, $user->experience);
    }

    public function testUserEntityReputationCastToInteger(): void
    {
        $user = new UserEntity();
        $user->fill(['reputation' => '42']);

        $this->assertIsInt($user->reputation);
        $this->assertSame(42, $user->reputation);
    }

    public function testUserEntitySettingsCastToJson(): void
    {
        // CI4's json cast encodes a PHP array/object to JSON on set, then decodes
        // back to stdClass on get. Pass the native PHP array (not a pre-encoded string).
        $settings = ['emailComment' => true, 'emailEdit' => false];
        $user     = new UserEntity();
        $user->fill(['settings' => $settings]);

        // CI4 Entity json cast decodes to stdClass
        $this->assertIsObject($user->settings);
        $this->assertTrue($user->settings->emailComment);
        $this->assertFalse($user->settings->emailEdit);
    }

    // =========================================================================
    // PlaceEntity
    // =========================================================================

    public function testPlaceEntityCanBeInstantiated(): void
    {
        $place = new PlaceEntity();

        $this->assertInstanceOf(PlaceEntity::class, $place);
    }

    public function testPlaceEntityDefaultLatLonAreZero(): void
    {
        $place = new PlaceEntity();

        $this->assertSame(0.0, $place->lat);
        $this->assertSame(0.0, $place->lon);
    }

    public function testPlaceEntityDefaultCountersAreZero(): void
    {
        $place = new PlaceEntity();

        $this->assertSame(0, $place->views);
        $this->assertSame(0, $place->photos);
        $this->assertSame(0, $place->comments);
        $this->assertSame(0, $place->bookmarks);
    }

    public function testPlaceEntityLatCastToFloat(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lat' => '55.7558']);

        $this->assertIsFloat($place->lat);
        $this->assertEqualsWithDelta(55.7558, $place->lat, 0.0001);
    }

    public function testPlaceEntityLonCastToFloat(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lon' => '37.6173']);

        $this->assertIsFloat($place->lon);
        $this->assertEqualsWithDelta(37.6173, $place->lon, 0.0001);
    }

    public function testPlaceEntityRatingCastToFloat(): void
    {
        $place = new PlaceEntity();
        $place->fill(['rating' => '4.3']);

        $this->assertIsFloat($place->rating);
        $this->assertEqualsWithDelta(4.3, $place->rating, 0.001);
    }

    public function testPlaceEntityViewsCastToInteger(): void
    {
        $place = new PlaceEntity();
        $place->fill(['views' => '150']);

        $this->assertIsInt($place->views);
        $this->assertSame(150, $place->views);
    }

    public function testPlaceEntityCountryIdCastToInteger(): void
    {
        $place = new PlaceEntity();
        $place->fill(['country_id' => '7']);

        $this->assertIsInt($place->country_id);
        $this->assertSame(7, $place->country_id);
    }

    // =========================================================================
    // PhotoEntity
    // =========================================================================

    public function testPhotoEntityCanBeInstantiated(): void
    {
        $photo = new PhotoEntity();

        $this->assertInstanceOf(PhotoEntity::class, $photo);
    }

    public function testPhotoEntityDefaultDimensionsAreZero(): void
    {
        $photo = new PhotoEntity();

        $this->assertSame(0, $photo->width);
        $this->assertSame(0, $photo->height);
        $this->assertSame(0, $photo->filesize);
    }

    public function testPhotoEntityFillSetsFilenameAndExtension(): void
    {
        $photo = new PhotoEntity();
        $photo->fill(['filename' => 'abc123', 'extension' => 'jpg']);

        $this->assertSame('abc123', $photo->filename);
        $this->assertSame('jpg', $photo->extension);
    }

    public function testPhotoEntityWidthCastToInteger(): void
    {
        $photo = new PhotoEntity();
        $photo->fill(['width' => '1920']);

        $this->assertIsInt($photo->width);
        $this->assertSame(1920, $photo->width);
    }

    public function testPhotoEntityLatCastToFloat(): void
    {
        $photo = new PhotoEntity();
        $photo->fill(['lat' => '59.9343']);

        $this->assertIsFloat($photo->lat);
        $this->assertEqualsWithDelta(59.9343, $photo->lat, 0.0001);
    }

    // =========================================================================
    // RatingEntity
    // =========================================================================

    public function testRatingEntityCanBeInstantiated(): void
    {
        $rating = new RatingEntity();

        $this->assertInstanceOf(RatingEntity::class, $rating);
    }

    public function testRatingEntityValueCastToInteger(): void
    {
        $rating = new RatingEntity();
        $rating->fill(['value' => '5']);

        $this->assertIsInt($rating->value);
        $this->assertSame(5, $rating->value);
    }

    public function testRatingEntityFillSetsPlaceAndSessionId(): void
    {
        $rating = new RatingEntity();
        $rating->fill(['place_id' => 'place_abc', 'session_id' => 'sess_xyz']);

        $this->assertSame('place_abc', $rating->place_id);
        $this->assertSame('sess_xyz', $rating->session_id);
    }

    // =========================================================================
    // CommentEntity
    // =========================================================================

    public function testCommentEntityCanBeInstantiated(): void
    {
        $comment = new CommentEntity();

        $this->assertInstanceOf(CommentEntity::class, $comment);
    }

    public function testCommentEntityFillSetsContent(): void
    {
        $comment = new CommentEntity();
        $comment->fill(['content' => 'Great place!']);

        $this->assertSame('Great place!', $comment->content);
    }

    public function testCommentEntityFillSetsPlaceAndUserIds(): void
    {
        $comment = new CommentEntity();
        $comment->fill(['place_id' => 'place1', 'user_id' => 'user1']);

        $this->assertSame('place1', $comment->place_id);
        $this->assertSame('user1', $comment->user_id);
    }

    // =========================================================================
    // TagEntity
    // =========================================================================

    public function testTagEntityCanBeInstantiated(): void
    {
        $tag = new TagEntity();

        $this->assertInstanceOf(TagEntity::class, $tag);
    }

    public function testTagEntityDefaultCountIsZero(): void
    {
        $tag = new TagEntity();

        $this->assertSame(0, $tag->count);
    }

    public function testTagEntityFillSetsBilingualTitles(): void
    {
        $tag = new TagEntity();
        $tag->fill(['title_ru' => 'Горы', 'title_en' => 'Mountains']);

        $this->assertSame('Горы', $tag->title_ru);
        $this->assertSame('Mountains', $tag->title_en);
    }

    public function testTagEntityCountCastToInteger(): void
    {
        $tag = new TagEntity();
        $tag->fill(['count' => '42']);

        $this->assertIsInt($tag->count);
        $this->assertSame(42, $tag->count);
    }

    // =========================================================================
    // PlaceContentEntity
    // =========================================================================

    public function testPlaceContentEntityCanBeInstantiated(): void
    {
        $content = new PlaceContentEntity();

        $this->assertInstanceOf(PlaceContentEntity::class, $content);
    }

    public function testPlaceContentEntityDefaultLocaleIsRu(): void
    {
        $content = new PlaceContentEntity();

        $this->assertSame('ru', $content->locale);
    }

    public function testPlaceContentEntityDefaultDeltaIsZero(): void
    {
        $content = new PlaceContentEntity();

        $this->assertSame(0, $content->delta);
    }

    public function testPlaceContentEntityFillSetsTitleAndContent(): void
    {
        $content = new PlaceContentEntity();
        $content->fill(['title' => 'Old Mill', 'content' => 'A historic mill.']);

        $this->assertSame('Old Mill', $content->title);
        $this->assertSame('A historic mill.', $content->content);
    }

    public function testPlaceContentEntityDeltaCastToInteger(): void
    {
        $content = new PlaceContentEntity();
        $content->fill(['delta' => '17']);

        $this->assertIsInt($content->delta);
        $this->assertSame(17, $content->delta);
    }

    // =========================================================================
    // SessionEntity
    // =========================================================================

    public function testSessionEntityCanBeInstantiated(): void
    {
        $session = new SessionEntity();

        $this->assertInstanceOf(SessionEntity::class, $session);
    }

    public function testSessionEntityLatLonCastToFloat(): void
    {
        $session = new SessionEntity();
        $session->fill(['lat' => '55.1', 'lon' => '37.9']);

        $this->assertIsFloat($session->lat);
        $this->assertIsFloat($session->lon);
    }

    // =========================================================================
    // ActivityEntity
    // =========================================================================

    public function testActivityEntityCanBeInstantiated(): void
    {
        $activity = new ActivityEntity();

        $this->assertInstanceOf(ActivityEntity::class, $activity);
    }

    public function testActivityEntityDefaultViewsIsZero(): void
    {
        $activity = new ActivityEntity();

        $this->assertSame(0, $activity->views);
    }

    public function testActivityEntityFillSetsType(): void
    {
        $activity = new ActivityEntity();
        $activity->fill(['type' => 'place']);

        $this->assertSame('place', $activity->type);
    }

    public function testActivityEntityViewsCastToInteger(): void
    {
        $activity = new ActivityEntity();
        $activity->fill(['views' => '7']);

        $this->assertIsInt($activity->views);
        $this->assertSame(7, $activity->views);
    }

    // =========================================================================
    // CategoryEntity
    // =========================================================================

    public function testCategoryEntityCanBeInstantiated(): void
    {
        $category = new CategoryEntity();

        $this->assertInstanceOf(CategoryEntity::class, $category);
    }

    public function testCategoryEntityFillSetsBilingualTitlesAndContent(): void
    {
        $category = new CategoryEntity();
        $category->fill([
            'name'       => 'historic',
            'title_ru'   => 'Историческое',
            'title_en'   => 'Historic',
            'content_ru' => 'Описание на русском',
            'content_en' => 'Description in English',
        ]);

        $this->assertSame('historic', $category->name);
        $this->assertSame('Историческое', $category->title_ru);
        $this->assertSame('Historic', $category->title_en);
        $this->assertSame('Описание на русском', $category->content_ru);
        $this->assertSame('Description in English', $category->content_en);
    }

    // =========================================================================
    // UserLevelEntity
    // =========================================================================

    public function testUserLevelEntityCanBeInstantiated(): void
    {
        $level = new UserLevelEntity();

        $this->assertInstanceOf(UserLevelEntity::class, $level);
    }

    public function testUserLevelEntityLevelCastToInteger(): void
    {
        $level = new UserLevelEntity();
        $level->fill(['level' => '3', 'experience' => '150']);

        $this->assertIsInt($level->level);
        $this->assertIsInt($level->experience);
        $this->assertSame(3, $level->level);
        $this->assertSame(150, $level->experience);
    }

    public function testUserLevelEntityIdCastToInteger(): void
    {
        $level = new UserLevelEntity();
        $level->fill(['id' => '2']);

        $this->assertIsInt($level->id);
        $this->assertSame(2, $level->id);
    }

    // =========================================================================
    // UserBookmarkEntity
    // =========================================================================

    public function testUserBookmarkEntityCanBeInstantiated(): void
    {
        $bookmark = new UserBookmarkEntity();

        $this->assertInstanceOf(UserBookmarkEntity::class, $bookmark);
    }

    public function testUserBookmarkEntityFillSetsIds(): void
    {
        $bookmark = new UserBookmarkEntity();
        $bookmark->fill(['user_id' => 'u1', 'place_id' => 'p1']);

        $this->assertSame('u1', $bookmark->user_id);
        $this->assertSame('p1', $bookmark->place_id);
    }

    // =========================================================================
    // LocationCountryEntity
    // =========================================================================

    public function testLocationCountryEntityCanBeInstantiated(): void
    {
        $country = new LocationCountryEntity();

        $this->assertInstanceOf(LocationCountryEntity::class, $country);
    }

    public function testLocationCountryEntityIdCastToInteger(): void
    {
        $country = new LocationCountryEntity();
        $country->fill(['id' => '7', 'title_en' => 'Russia', 'title_ru' => 'Россия']);

        $this->assertIsInt($country->id);
        $this->assertSame(7, $country->id);
        $this->assertSame('Russia', $country->title_en);
        $this->assertSame('Россия', $country->title_ru);
    }
}
