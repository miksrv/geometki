import { ApiType } from '@/api'

/** Quests a page of `/quests`: twelve tiles, rows of two or three */
export const QUESTS_PER_PAGE = 12

/** The begun walks on the shelf over the list: all of them, as many as one may begin at once (server `QuestsLibrary::ACTIVE_MAX`) */
export const QUESTS_ACTIVE_LIMIT = 10

/** The modes in the order of the filter's tabs (`?mode=`) */
export const QUEST_MODES: ApiType.Game.QuestMode[] = ['open', 'steps', 'riddles', 'photos']
