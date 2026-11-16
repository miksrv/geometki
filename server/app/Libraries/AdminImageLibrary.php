<?php

namespace App\Libraries;

use CodeIgniter\HTTP\Files\UploadedFile;
use DOMDocument;
use DOMElement;

/**
 * The pictures an administrator uploads (the badges of achievements, the pictures and medals of
 * seasons): PNG or SVG up to 1 MB, checked by the content, never by the name the client gave.
 * An SVG is a page that can run a script, so one with a script, an event handler, a foreign
 * object, a `javascript:` link or a reference outside of the file is refused.
 */
class AdminImageLibrary
{
    public const MAX_SIZE = 1024 * 1024;

    /** What finfo calls an SVG: by its content it can be plain text or XML too */
    private const SVG_MIMES = ['image/svg+xml', 'image/svg', 'text/plain', 'text/xml', 'application/xml', 'text/html'];

    /** The elements that run something or load something from outside */
    private const FORBIDDEN_ELEMENTS = ['script', 'foreignobject', 'iframe', 'embed', 'object', 'audio', 'video', 'link', 'meta', 'animate', 'set', 'handler'];

    /**
     * The kind of a valid picture, `png` or `svg`; null for anything else (the wrong type, too
     * big, an unsafe SVG).
     *
     * @return 'png'|'svg'|null
     */
    public static function kind(UploadedFile $file): ?string
    {
        if (!$file->isValid() || $file->getSize() > self::MAX_SIZE || $file->getSize() < 1) {
            return null;
        }

        $mime = $file->getMimeType();

        if ($mime === 'image/png') {
            return 'png';
        }

        if (!in_array($mime, self::SVG_MIMES, true)) {
            return null;
        }

        $content = file_get_contents($file->getRealPath() ?: $file->getPathname());

        return $content !== false && self::isSafeSvg($content) ? 'svg' : null;
    }

    /** Whether a text is a well-formed SVG with nothing in it that runs or reaches out */
    public static function isSafeSvg(string $content): bool
    {
        // An XML prologue is optional; a doctype can declare entities (XXE, a billion laughs)
        if (!preg_match('/<svg[\s>]/i', $content) || preg_match('/<!(DOCTYPE|ENTITY)/i', $content)) {
            return false;
        }

        // The loose check first, on the raw text: a script by any spelling of the tag
        if (preg_match('/<\s*(script|foreignObject)|javascript\s*:/i', $content)) {
            return false;
        }

        $previous = libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $loaded   = $document->loadXML($content, LIBXML_NONET | LIBXML_NOWARNING | LIBXML_NOERROR);

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (!$loaded || !$document->documentElement || strtolower($document->documentElement->localName) !== 'svg') {
            return false;
        }

        foreach ($document->getElementsByTagName('*') as $element) {
            if (!self::isSafeElement($element)) {
                return false;
            }
        }

        return true;
    }

    private static function isSafeElement(DOMElement $element): bool
    {
        $name = strtolower($element->localName);

        if (in_array($name, self::FORBIDDEN_ELEMENTS, true)) {
            return false;
        }

        // A style can import a sheet or load a picture from outside
        if ($name === 'style' && preg_match('/@import|url\(\s*+[\'"]?+\s*+(?!#)/i', $element->textContent)) {
            return false;
        }

        foreach ($element->attributes as $attribute) {
            $attr  = strtolower($attribute->localName);
            $value = trim($attribute->value);

            if (str_starts_with($attr, 'on') || preg_match('/^\s*(javascript|data|vbscript)\s*:/i', $value)) {
                return false;
            }

            // A reference inside the file only (`#id`)
            if ($attr === 'href' && !str_starts_with($value, '#')) {
                return false;
            }

            if ($attr === 'style' && preg_match('/@import|expression\(|url\(\s*+[\'"]?+\s*+(?!#)/i', $value)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Saves an uploaded picture into `uploads/<folder>/` under a name made here (the extension
     * from the content, not from the client).
     *
     * @return string|null the stored path (`uploads/<folder>/<name>`), null when it could not be moved
     */
    public static function store(UploadedFile $file, string $kind, string $folder, string $prefix): ?string
    {
        $dir = FCPATH . 'uploads/' . $folder . '/';

        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return null;
        }

        $name = $prefix . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $kind;

        return $file->move($dir, $name) ? 'uploads/' . $folder . '/' . $name : null;
    }

    /** Whether a stored path is a file of the folder (and nothing else: no subfolder, no `..`) */
    public static function isOwnPath(?string $path, string $folder): bool
    {
        return is_string($path) && (bool) preg_match('#^uploads/' . preg_quote($folder, '#') . '/[A-Za-z0-9_-][A-Za-z0-9._-]*$#', $path);
    }

    /** Deletes a picture of the folder; any other path is left alone */
    public static function remove(?string $path, string $folder): void
    {
        if (self::isOwnPath($path, $folder)) {
            @unlink(FCPATH . $path);
        }
    }
}
