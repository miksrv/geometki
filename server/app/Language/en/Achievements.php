<?php

return [
    'notFound'       => 'Achievement not found.',
    'createError'    => 'An error occurred while creating the achievement. Please try again.',
    'updateError'    => 'An error occurred while updating the achievement. Please try again.',
    'deleteError'    => 'An error occurred while deleting the achievement. Please try again.',
    'badBody'        => 'The request body must be a JSON object.',
    'nothingToUpdate' => 'Nothing to update: send at least one known field.',
    'badImageFile'   => 'Only PNG and SVG files up to 1 MB are allowed, and an SVG must be free of scripts and outside references.',
    'noImage'        => 'No valid image file provided.',
    'saveImageError' => 'Failed to save the image.',
    'badEnum'        => 'Unknown value. Allowed: {0}.',
    'titleRequired'  => 'The Russian title is required.',
    'textLong'       => 'At most {0} characters.',
    'notString'      => 'Must be a string.',
    'slugRequired'   => 'A group slug of Latin letters, digits, hyphens and underscores (up to 50) is required.',
    'badDate'        => 'A date as YYYY-MM-DD.',
    'seasonDates'    => 'A seasonal award needs both dates, the start not after the end.',
    'badInt'         => 'A whole number from 0 to {0}.',
    'badBool'        => 'Must be true or false.',
    'badRules'       => 'Rules: a list of { metric, value } with a known metric and a number.',
    'badImagePath'   => 'The image must be a file from uploads/achievements or null.',
];
