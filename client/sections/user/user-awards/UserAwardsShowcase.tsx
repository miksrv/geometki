import React, { useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { AwardButton, AwardMore, AwardPicture } from './AwardButton'
import { AwardDialog } from './AwardDialog'
import { AwardRow } from './AwardRow'
import { AwardsDialog } from './AwardsDialog'
import { Award, useUserAwards } from './useUserAwards'

/** The smallest hexagon of the profile's head: the row grows them to the width of the counters */
const MIN_SIZE = 56

interface UserAwardsShowcaseProps {
    userId: string
}

/**
 * The awards of a person in the head of their profile, under the counters: one row of hexagons
 * as wide as the counters — the seasons, the quests, then the achievements, the newest first.
 * A hexagon opens the award's card; the last cell "+N" opens every award, the ones not earned
 * yet too. Shown always: a newcomer sees the awards to earn.
 */
export const UserAwardsShowcase: React.FC<UserAwardsShowcaseProps> = ({ userId }) => {
    const { t } = useTranslation()
    const awards = useUserAwards(userId)

    const [selected, setSelected] = useState<Award>()
    const [allOpen, setAllOpen] = useState<boolean>(false)

    // The rule of the row, always: the earned ones first, then the ones not earned yet to the end
    // of the row — a newcomer sees what can be earned —, the last cell the way to every award.
    // Nothing only while there is nothing at all (the list not loaded yet)
    if (!awards.earned.length && !awards.locked.length) {
        return null
    }

    return (
        <>
            <AwardRow
                minSize={MIN_SIZE}
                aria-label={t('user-side-awards')}
                items={[...awards.earned, ...awards.locked].map((award) => ({
                    key: award.key,
                    node: (size) => (
                        <AwardButton
                            award={award}
                            size={size}
                            onOpen={setSelected}
                        />
                    ),
                    picture: (size) => (
                        <AwardPicture
                            award={award}
                            size={size}
                        />
                    )
                }))}
                more={(hidden, _size, under) => (
                    <AwardMore
                        hidden={hidden}
                        under={under}
                        onClick={() => setAllOpen(true)}
                    />
                )}
            />

            {selected && (
                <AwardDialog
                    award={selected}
                    onClose={() => setSelected(undefined)}
                />
            )}

            {allOpen && (
                <AwardsDialog
                    awards={awards}
                    onClose={() => setAllOpen(false)}
                />
            )}
        </>
    )
}
