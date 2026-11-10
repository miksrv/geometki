<?php

namespace Config;

/**
 * Rules for the user's display name (App\Libraries\UserName).
 *
 * Names are not unique: a profile is found by its id, the name is only a label.
 * The client mirrors these limits in client/utils/userName.ts.
 */
class Users
{
    /** Fewest letters or digits a name must hold (two-letter names, like "Ян", exist). */
    public const NAME_MIN = 2;

    /** Most characters in a name. */
    public const NAME_MAX = 40;
}
