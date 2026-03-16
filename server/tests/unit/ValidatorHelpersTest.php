<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for pure helper functions found in app/Helpers/.
 *
 * All tests are database-free and HTTP-free.
 *
 * @internal
 */
final class ValidatorHelpersTest extends CIUnitTestCase
{
    // -------------------------------------------------------------------------
    // rating_helper: transformRating()
    // -------------------------------------------------------------------------

    public function testTransformRatingScoreOneReturnsMinus2(): void
    {
        helper('rating');

        $this->assertSame(-2, transformRating(1));
    }

    public function testTransformRatingScoreTwoReturnsMinus1(): void
    {
        helper('rating');

        $this->assertSame(-1, transformRating(2));
    }

    public function testTransformRatingScoreThreeReturnsZero(): void
    {
        helper('rating');

        $this->assertSame(0, transformRating(3));
    }

    public function testTransformRatingScoreFourReturnsPlus1(): void
    {
        helper('rating');

        $this->assertSame(1, transformRating(4));
    }

    public function testTransformRatingScoreFiveReturnsPlus2(): void
    {
        helper('rating');

        $this->assertSame(2, transformRating(5));
    }

    public function testTransformRatingUnknownScoreReturnsZero(): void
    {
        helper('rating');

        // Values not explicitly handled by the match expression fall through to default => 0
        $this->assertSame(0, transformRating(0));
        $this->assertSame(0, transformRating(6));
        $this->assertSame(0, transformRating(-1));
    }

    public function testTransformRatingReturnTypeIsInt(): void
    {
        helper('rating');

        $this->assertIsInt(transformRating(5));
    }

    // -------------------------------------------------------------------------
    // auth_helper: hashUserPassword()
    // -------------------------------------------------------------------------

    public function testHashUserPasswordReturnsNonEmptyString(): void
    {
        helper('auth');

        $hash = hashUserPassword('SecurePass123');

        $this->assertIsString($hash);
        $this->assertNotEmpty($hash);
    }

    public function testHashUserPasswordProducesVerifiableHash(): void
    {
        helper('auth');

        $password = 'MySecretPassword!';
        $hash     = hashUserPassword($password);

        $this->assertTrue(password_verify($password, $hash));
    }

    public function testHashUserPasswordDoesNotMatchWrongPassword(): void
    {
        helper('auth');

        $hash = hashUserPassword('CorrectPassword');

        $this->assertFalse(password_verify('WrongPassword', $hash));
    }

    public function testHashUserPasswordUseArgon2idAlgorithm(): void
    {
        helper('auth');

        $hash = hashUserPassword('TestPassword');
        $info = password_get_info($hash);

        $this->assertSame(PASSWORD_ARGON2ID, $info['algo']);
    }

    public function testHashUserPasswordEachCallProducesDifferentHash(): void
    {
        helper('auth');

        // Argon2id uses random salt per call — same input must produce different hashes
        $hash1 = hashUserPassword('SamePassword');
        $hash2 = hashUserPassword('SamePassword');

        $this->assertNotSame($hash1, $hash2);
    }

    // -------------------------------------------------------------------------
    // auth_helper: generateAuthToken()
    // -------------------------------------------------------------------------

    public function testGenerateAuthTokenReturnsNonEmptyString(): void
    {
        helper('auth');

        // JWT secret may not be set in CI environment; generateAuthToken will still return a
        // valid-structure token string when Services::getSecretKey() returns a fallback value.
        // We only assert structural shape here.
        $token = generateAuthToken('test@example.com');

        $this->assertIsString($token);
        $this->assertNotEmpty($token);
    }

    public function testGenerateAuthTokenHasThreeJwtParts(): void
    {
        helper('auth');

        $token  = generateAuthToken('user@example.com');
        $parts  = explode('.', $token);

        // A well-formed JWT always has exactly three dot-separated base64url segments
        $this->assertCount(3, $parts);
    }

    public function testGenerateAuthTokenPayloadContainsEmail(): void
    {
        helper('auth');

        $email   = 'check@example.com';
        $token   = generateAuthToken($email);
        $parts   = explode('.', $token);

        // Decode the payload (second segment); base64url decode
        $payloadJson = base64_decode(strtr($parts[1], '-_', '+/'));
        $payload     = json_decode($payloadJson, true);

        $this->assertIsArray($payload);
        $this->assertArrayHasKey('email', $payload);
        $this->assertSame($email, $payload['email']);
    }

    public function testGenerateAuthTokenPayloadHasIatAndExp(): void
    {
        helper('auth');

        $token   = generateAuthToken('ts@example.com');
        $parts   = explode('.', $token);
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);

        $this->assertArrayHasKey('iat', $payload);
        $this->assertArrayHasKey('exp', $payload);
        $this->assertGreaterThan($payload['iat'], $payload['exp']);
    }

    // -------------------------------------------------------------------------
    // exif_helper: getPhotoLocation() — pure logic branches that do not read
    // real files (non-existent path returns null immediately)
    // -------------------------------------------------------------------------

    public function testGetPhotoLocationReturnNullForMissingFile(): void
    {
        helper('exif');

        $result = getPhotoLocation('/non/existent/path/photo.jpg');

        $this->assertNull($result);
    }

    public function testGetPhotoLocationReturnNullForEmptyPath(): void
    {
        helper('exif');

        $result = getPhotoLocation('');

        $this->assertNull($result);
    }
}
