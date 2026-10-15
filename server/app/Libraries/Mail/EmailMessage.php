<?php

namespace App\Libraries\Mail;

/**
 * A rendered email ready for the transport.
 */
class EmailMessage
{
    /**
     * @param string      $to             Recipient address
     * @param string      $subject        Subject line
     * @param string      $html           Full HTML document
     * @param string      $text           Plain-text alternative
     * @param string|null $unsubscribeUrl One-click unsubscribe URL (List-Unsubscribe); null for transactional mail
     * @param string|null $category       Notification type, for the List-Id-like `X-Geometki-Category` header
     */
    public function __construct(
        public readonly string $to,
        public readonly string $subject,
        public readonly string $html,
        public readonly string $text,
        public readonly ?string $unsubscribeUrl = null,
        public readonly ?string $category = null,
    ) {
    }
}
