<?php

/**
 * Run from CLI:
 *   php spark system:send-email
 *
 * Add to cron:
 *   * * * * * cd /path/to/server && php spark system:send-email >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Libraries\EmailLibrary;
use App\Libraries\PlacesContent;
use App\Models\PlacesModel;
use App\Models\SendingMail;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Exception;

class SendEmail extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:send-email';
    protected $description = 'Process and send queued notification emails';

    private const DAY_EMAIL_LIMIT  = 2000;
    private const HOUR_EMAIL_LIMIT = 500;

    public function run(array $params)
    {
        $sendingEmailModel = new SendingMail();
        $sendingEmailData  = $sendingEmailModel
            ->select('activity.type, activity.place_id, sending_mail.*')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left')
            ->where('sending_mail.status = "created"')
            ->where('sending_mail.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)')
            ->orderBy('created_at', 'DESC')
            ->findAll();

        $dayEmailCount = $sendingEmailModel
            ->select('id')
            ->where('status = "completed"')
            ->where('created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)')
            ->countAllResults();

        $hourEmailCount = $sendingEmailModel
            ->select('id')
            ->where('status = "completed"')
            ->where('created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)')
            ->countAllResults();

        /**
         * If you have exceeded the hoster's limits for sending emails, then we will not send anything.
         */
        if (empty($sendingEmailData)) {
            CLI::write('No emails to process.', 'yellow');
            return;
        }

        if ($dayEmailCount >= self::DAY_EMAIL_LIMIT) {
            CLI::write('Daily email limit reached (' . self::DAY_EMAIL_LIMIT . '). Skipping.', 'red');
            return;
        }

        if ($hourEmailCount >= self::HOUR_EMAIL_LIMIT) {
            CLI::write('Hourly email limit reached (' . self::HOUR_EMAIL_LIMIT . '). Skipping.', 'red');
            return;
        }

        $placeContent = new PlacesContent(350);
        $emailLibrary = new EmailLibrary();
        $placesIds    = [];
        $placesData   = [];

        // Email statistics counters
        $sentCount     = 0;
        $rejectedCount = 0;
        $errorCount    = 0;

        // Collect all places IDs
        foreach ($sendingEmailData as $item) {
            if ($item->place_id) {
                $placesIds[] = $item->place_id;
            }
        }

        // If we have collected IDs of places, we will get information about them from the database and download translations
        if ($placesIds) {
            $placesModel = new PlacesModel();
            $placesData  = $placesModel->select('id, photos')->whereIn('id', $placesIds)->findAll();
            $placeContent->translate($placesIds);
        }

        // We begin to sort through all unsent letters
        foreach ($sendingEmailData as $item) {
            /**
             * If there is no address where to send the letter,
             * OR if it is NOT a notification and there is no body of the letter, we immediately reject it
             */
            if (empty($item->email) || (empty($item->type) && !$item->message)) {
                $sendingEmailModel->update($item->id, ['status' => 'rejected']);
                $rejectedCount++;

                continue ;
            }

            $locale  = $item->locale ?? 'ru';
            $message = '';
            $subject = isset($item->type) && $item->type
                ? lang('SendingMail.emailSubject_' . $item->type , [], $locale)
                : $item->subject;

            $findPlace = array_search($item->place_id, array_column($placesData, 'id'));

            $placeCover = null;

            /**
             * If the letter is a notification, then we look for an interesting place by its ID in a previously prepared
             * We will need the name of the geotag and the cover image
             */
            if ($findPlace !== false) {
                $placeId    = $placesData[$findPlace]->id;
                $placeTitle = $placeContent->title($placeId);
                $placeCover = $placesData[$findPlace]->photos && file_exists(UPLOAD_PHOTOS . $placeId . '/cover.jpg')
                    ? PATH_PHOTOS . $placeId . '/cover.jpg'
                    : null;

                $message .= "<h2>{$placeTitle}</h2>";
                $message .= "<p>{$subject}</p>";

                // Placeholder for cover image - will be replaced with actual CID after email init
                if ($placeCover) {
                    $message .= "<p><img src='cid:COVER_IMAGE_CID' alt='{$placeTitle}' style='width: 100%'>";
                }
                $message .= '<p>' . lang('SendingMail.placeModified' , [], $locale) . '</p>';
                $message  = view('email', [
                    'message'     => $message,
                    'preheader'   => lang('SendingMail.placeModified' , [], $locale),
                    'actionText'  => lang('SendingMail.placeOpenText' , [], $locale),
                    'actionLink'  => 'https://geometki.com/places/' . $placeId,
                    'unsubscribe' => 'https://geometki.com/unsubscribe?mail=' . $item->id,
                ]);

            } else {
                // Check if this is a digest email (no activity_id and has subject)
                $isDigest = empty($item->activity_id) && !empty($item->subject);
                
                $emailParams = ['message' => $item->message];
                
                if ($isDigest) {
                    $emailParams['preheader']   = $item->subject;
                    $emailParams['unsubscribe'] = 'https://geometki.com/unsubscribe?mail=' . $item->id;
                }
                
                $message = view('email', $emailParams);
            }

            try {
                $emailLibrary->sendWithAttachment($item->email, $subject, $message, $placeCover);
                $sendingEmailModel->update($item->id, ['status' => 'completed']);
                $sentCount++;
            } catch (Exception $e) {
                log_message('error', '{exception}', ['exception' => $e]);
                $sendingEmailModel->update($item->id, ['status' => 'error']);
                $errorCount++;
            }
        }

        CLI::write('Email processing complete.', 'green');
        CLI::write('  Sent: ' . $sentCount, 'green');
        CLI::write('  Rejected: ' . $rejectedCount, 'yellow');
        CLI::write('  Errors: ' . $errorCount, $errorCount > 0 ? 'red' : 'green');
    }
}
