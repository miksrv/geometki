<?php

namespace App\Libraries;

use CodeIgniter\Files\File;
use Config\Services;

class AvatarLibrary
{
    /**
     * Build the public URL path to a sized avatar variant.
     *
     * @param string|null $userId   User ID (used as directory name).
     * @param string|null $filename Raw avatar filename as stored in the DB (e.g. "abc123.jpg").
     * @param string      $size     One of 'small' or 'medium'.
     * @return string|null          Full path or null when filename is absent.
     */
    public function buildPath(?string $userId, ?string $filename, string $size = 'small'): ?string
    {
        if (empty($filename) || empty($userId)) {
            return null;
        }

        $parts = explode('.', $filename);

        if (count($parts) < 2) {
            return null;
        }

        return PATH_AVATARS . $userId . '/' . $parts[0] . '_' . $size . '.' . $parts[1];
    }

    /**
     * Move a source file into the user's avatar directory and generate
     * _small and _medium cropped variants.
     *
     * @param string $userId
     * @param string $sourcePath  Full filesystem path to the source file (already in temp dir).
     * @return string             The new base filename (e.g. "randomname.jpg").
     */
    public function processUpload(string $userId, string $sourcePath): string
    {
        $avatarDir = UPLOAD_AVATARS . $userId . '/';

        if (!is_dir($avatarDir)) {
            mkdir($avatarDir, 0777, true);
        }

        $file = new File($sourcePath);
        $rand = $file->getRandomName();
        $file->move($avatarDir, $rand, true);

        $name  = explode('.', $rand);
        $image = Services::image('gd');

        $image->withFile($avatarDir . $rand)
            ->fit(AVATAR_SMALL_WIDTH, AVATAR_SMALL_HEIGHT)
            ->save($avatarDir . $name[0] . '_small.' . $name[1]);

        $image->withFile($avatarDir . $rand)
            ->fit(AVATAR_MEDIUM_WIDTH, AVATAR_MEDIUM_HEIGHT)
            ->save($avatarDir . $name[0] . '_medium.' . $name[1]);

        return $rand;
    }

    /**
     * Remove the original avatar file and its sized variants.
     *
     * @param string $userId
     * @param string $filename  Raw avatar filename as stored in the DB (e.g. "abc123.jpg").
     */
    public function deleteOld(string $userId, string $filename): void
    {
        $dir   = UPLOAD_AVATARS . $userId . '/';
        $parts = explode('.', $filename);

        @unlink($dir . $filename);

        if (count($parts) >= 2) {
            @unlink($dir . $parts[0] . '_small.'  . $parts[1]);
            @unlink($dir . $parts[0] . '_medium.' . $parts[1]);
        }
    }
}
