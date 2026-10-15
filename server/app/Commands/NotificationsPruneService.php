<?php

/**
 * Deletes everything notifications left for service accounts (emails in
 * Notifications::$serviceEmailDomains, e.g. user2@geometki.com), which are never
 * notified any more: in-app notifications (`users_notifications`), pushes
 * (`push_messages`) and emails (`sending_mail`, sent or queued, including
 * soft-deleted rows), all for good.
 *
 *   cd server
 *   php spark notifications:prune-service --dry-run   # only count
 *   php spark notifications:prune-service
 *
 * A one-off clean-up: new notifications for service accounts are not created.
 */

namespace App\Commands;

use App\Libraries\NotificationSettings;
use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;

class NotificationsPruneService extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'notifications:prune-service';
    protected $description = 'Delete notifications, pushes and emails of service accounts';
    protected $usage       = 'notifications:prune-service [--dry-run]';
    protected $options     = ['--dry-run' => 'Only count the rows, delete nothing'];

    private const TABLES = ['users_notifications', 'push_messages', 'sending_mail'];

    public function run(array $params)
    {
        $isDryRun = CLI::getOption('dry-run') !== null;
        $config   = config('Notifications');
        $settings = new NotificationSettings($config);
        $db       = Database::connect();

        if (empty($config->serviceEmailDomains)) {
            CLI::write('No service email domains configured. Nothing to do.', 'yellow');
            return;
        }

        // Narrow down by LIKE, decide by the same rule the notifications use
        $users = (new UsersModel())->withDeleted()->select('id, email');
        $users->groupStart();
        foreach ($config->serviceEmailDomains as $domain) {
            $users->orLike('email', '@' . $domain, 'before');
        }
        $users->groupEnd();

        $userIds = array_values(array_map(
            static fn ($user) => $user->id,
            array_filter($users->findAll(), static fn ($user) => $settings->isServiceEmail($user->email ?? null))
        ));

        CLI::write('Service accounts: ' . count($userIds), 'cyan');

        $total = 0;

        foreach (self::TABLES as $table) {
            $builder = $db->table($table);
            $builder->groupStart();

            if ($userIds) {
                $builder->whereIn('user_id', $userIds);
            } else {
                $builder->where('1 = 0', null, false);
            }

            // Emails also by the address itself: a row may outlive its user or have none
            if ($table === 'sending_mail') {
                foreach ($config->serviceEmailDomains as $domain) {
                    $builder->orLike('email', '@' . $domain, 'before');
                }
            }

            $builder->groupEnd();

            $count = $isDryRun ? $builder->countAllResults() : $this->delete($builder);
            $total += $count;

            CLI::write(sprintf('%-20s %d', $table, $count));
        }

        CLI::write(
            $isDryRun ? "Would delete $total rows (dry run)." : "Deleted $total rows.",
            'green'
        );
    }

    private function delete($builder): int
    {
        $builder->delete();

        return $builder->db()->affectedRows();
    }
}
