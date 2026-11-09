<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * Who may change a photo or a place: a photo is turned or deleted by its author or an admin
 * (403 for anyone else, 401 for a guest); a place is deleted by an admin only; a cover is cut
 * from a photo of that place only.
 *
 * @internal
 */
final class PhotoPermissionsTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('author');
        $this->createUser('other');

        foreach (['place1', 'place2'] as $place) {
            $this->db->table('places')->insert(['id' => $place, 'user_id' => 'author', 'category' => 'waterfall', 'lat' => 53.1, 'lon' => 57.2]);
        }

        $this->db->table('photos')->insert([
            'id' => 'photo1', 'place_id' => 'place1', 'user_id' => 'author', 'lat' => 53.1, 'lon' => 57.2,
            'filename' => 'missing-file', 'extension' => 'jpg', 'filesize' => 1000, 'width' => 1200, 'height' => 800,
        ]);
    }

    public function testOnlyTheAuthorOrAnAdminTurnsOrDeletesAPhoto(): void
    {
        $this->withBodyFormat('json')->patch('photos/rotate/photo1')->assertStatus(401);

        $this->signIn('other');
        $this->withBodyFormat('json')->patch('photos/rotate/photo1')->assertStatus(403);
        $this->delete('photos/photo1')->assertStatus(403);

        // The author's photo without its file on disk: not found, not a server error
        $this->signIn('author');
        $this->withBodyFormat('json')->patch('photos/rotate/photo1')->assertStatus(404);

        $this->assertSame(1, $this->db->table('photos')->where('id', 'photo1')->countAllResults());
    }

    public function testOnlyAnAdminDeletesAPlace(): void
    {
        $this->delete('places/place1')->assertStatus(401);

        $this->signIn('author');
        $this->delete('places/place1')->assertStatus(403);

        $this->assertSame(1, $this->db->table('places')->where('id', 'place1')->where('deleted_at', null)->countAllResults());
    }

    public function testACoverIsCutFromAPhotoOfThePlaceOnly(): void
    {
        $this->signIn('author');

        $crop = ['photoId' => 'photo1', 'x' => 0, 'y' => 0, 'width' => 1200, 'height' => 800];

        // Another place's photo, and this place's photo without its file: a validation error, never a 500
        $this->withBodyFormat('json')->patch('places/cover/place2', $crop)->assertStatus(400);
        $this->withBodyFormat('json')->patch('places/cover/place1', $crop)->assertStatus(400);
    }
}
