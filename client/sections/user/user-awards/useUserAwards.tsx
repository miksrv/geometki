import React, { useMemo } from 'react'

import { API, ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { QuestMedal } from '@/sections/game/quest-medal'
import { SeasonMedal } from '@/sections/game/season-medals'
import { AchievementGroup, groupAchievements } from '@/utils/achievements'
import { questHref, seasonHref } from '@/utils/game'

/** Walked quests asked for at once: the API's page limit */
const QUESTS_LIMIT = 48

export type AwardKind = 'season' | 'quest' | 'achievement'

/** One hexagon of the profile: a season played, a quest walked, an achievement (its best step) */
export interface Award {
    key: string
    kind: AwardKind
    title: string
    /** The picture at a size: the medal, the season's picture, the quest's cover */
    picture: (size: number) => React.ReactNode
    /** The page it leads to: a season, a quest */
    href?: string
    season?: ApiType.Game.Participation
    quest?: ApiType.Game.Quest
    /** An achievement with all its steps (no progress: the card asks for it) */
    group?: AchievementGroup
    /** Whose award it is: the card of an achievement asks for its progress */
    userId?: string
    /** An achievement not earned yet: grey under a lock (`AwardPicture`) */
    locked?: boolean
}

export interface UserAwardsData {
    /** Everything earned: the seasons (the latest first), the quests, the achievements (the newest first) */
    earned: Award[]
    /** The permanent (`base`) achievements not earned yet, the closest first */
    locked: Award[]
}

const achievementAward = (group: AchievementGroup, userId?: string): Award => {
    const shown = group.achieved ?? group.next ?? group.steps[0]

    return {
        group,
        key: `achievement-${group.key}`,
        kind: 'achievement',
        locked: !group.achieved,
        picture: (size) => (
            <AchievementIcon
                image={shown.image}
                alt={''}
                size={size}
                tier={shown.tier}
                category={shown.type === 'seasonal' ? 'seasonal' : undefined}
                group={shown.group_slug}
            />
        ),
        title: shown.title,
        userId
    }
}

/**
 * The awards of a person for their profile, asked in the browser (the profile is cached without
 * a viewer): the achievements (prefetched with the overview), the seasons of the game and the
 * walked quests, and the achievements not earned yet, with the progress to them.
 */
export const useUserAwards = (userId?: string): UserAwardsData => {
    const skip = !userId

    const { data: achievements } = API.useGetUserAchievementsQuery(userId ?? '', { skip })
    const { data: game } = API.useGameGetUserQuery(userId ?? '', { skip })
    const { data: walked } = API.useQuestsGetListQuery(
        { limit: QUESTS_LIMIT, user: userId, walk: 'done' },
        { skip: skip || !game?.walked }
    )

    return useMemo(() => {
        const groups = groupAchievements(achievements?.data ?? [])

        const seasons: Award[] = (game?.seasons ?? []).map((season) => ({
            href: seasonHref(season.id, season.slug, !!game?.season?.current && season.id === game.season.id),
            key: `season-${season.id}`,
            kind: 'season',
            picture: (size) =>
                season.closed && season.medal ? (
                    <SeasonMedal
                        kind={season.medal}
                        image={season.medalImage}
                        size={size}
                    />
                ) : (
                    <AchievementIcon
                        image={season.image}
                        size={size}
                        category={'seasonal'}
                        group={`season-${season.id}`}
                    />
                ),
            season,
            title: season.title
        }))

        const quests: Award[] = (walked?.items ?? []).map((quest) => ({
            href: questHref(quest.id, quest.slug),
            key: `quest-${quest.id}`,
            kind: 'quest',
            picture: (size) => (
                <QuestMedal
                    quest={quest}
                    size={size}
                />
            ),
            quest,
            title: quest.title
        }))

        // The newest first
        const earnedAchievements = groups
            .filter((group) => !!group.achieved)
            .sort((a, b) => (b.achieved?.earned_at?.date ?? '').localeCompare(a.achieved?.earned_at?.date ?? ''))
            .map((group) => achievementAward(group, userId))

        // Only the permanent ones: a season's or a limited achievement not earned is no goal for
        // ever. In the order of the catalogue: the list counts no progress
        const locked = groups
            .filter((group) => !group.achieved && group.steps[0].type === 'base')
            .map((group) => achievementAward(group, userId))

        return { earned: [...seasons, ...quests, ...earnedAchievements], locked }
    }, [achievements, game, walked, userId])
}
