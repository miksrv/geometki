import { HYDRATE } from 'next-redux-wrapper'
import type { Action, PayloadAction } from '@reduxjs/toolkit'
import { createApi, fetchBaseQuery, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'

import { ApiType } from '@/api'
import { RootState } from '@/app/store'
import { API_HOST } from '@/config/env'
import { encodeQueryData } from '@/utils/url'

type Maybe<T> = T | void

/** Page size of the notification list under the bell */
export const NOTIFICATIONS_PAGE_SIZE = 10

type APIErrorType = {
    messages: {
        error?: string
    }
}

/**
 * Safely extracts error message from API response.
 * Returns the error string or undefined if not available.
 */
const extractErrorMessage = (response: FetchBaseQueryError): string | undefined => {
    const data = response.data as APIErrorType | undefined
    return data?.messages?.error
}

/**
 * Returns the full error response data for form validation errors.
 */
const extractErrorData = (response: FetchBaseQueryError): unknown => {
    return response.data
}

const isHydrateAction = (action: Action): action is PayloadAction<RootState> => action.type === HYDRATE

export const API = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: API_HOST,
        prepareHeaders: (headers, { endpoint, getState, type }) => {
            // By default, if we have a token in the store, let's use that for authenticated requests
            const token = (getState() as RootState).auth.token
            const session = (getState() as RootState).auth.session
            const locale = (getState() as RootState).application.locale

            if (token) {
                headers.set('Authorization', token)
            }

            // A guest's session only where the server needs it: the writes (their score, the view
            // that answers their score) and the rating refetched after they scored. Any other
            // guest GET carries nothing of theirs, so the API answers it from its guest cache
            // (GuestCacheFilter). A signed-in user's device is told apart by it in every request
            if (session && (token || type === 'mutation' || endpoint === 'ratingGetList')) {
                headers.set('Session', session)
            }

            if (locale) {
                headers.set('Locale', locale)
            }

            // A request from getServerSideProps comes from the Next server's IP, not the
            // visitor's: the API does not mark the visitor's session with it
            if (typeof window === 'undefined') {
                headers.set('X-SSR', '1')
            }

            return headers
        }
    }),
    endpoints: (builder) => ({
        /** Controller: Achievements **/
        getUserAchievements: builder.query<{ data: ApiType.Achievements.Achievement[] }, string>({
            providesTags: ['UserAchievements'],
            query: (userId) => `users/${userId}/achievements`
        }),
        /** One achievement of a profile, every step with the progress counted now: the card of the award */
        getUserAchievementGroup: builder.query<
            { data: ApiType.Achievements.Achievement[] },
            { userId: string; group: string }
        >({
            providesTags: ['UserAchievements'],
            query: ({ userId, group }) => `users/${userId}/achievements/${encodeURIComponent(group)}`
        }),
        getAchievementsManage: builder.query<{ data: ApiType.Achievements.AchievementAdmin[] }, void>({
            providesTags: ['AchievementsManage'],
            query: () => 'achievements/manage'
        }),
        getAchievementsRecent: builder.query<
            { items: ApiType.Achievements.AchievementRecent[] },
            Maybe<{ limit?: number }>
        >({
            providesTags: ['AchievementsManage'],
            query: (params) => `achievements/manage/recent${encodeQueryData(params)}`
        }),
        createAchievement: builder.mutation<
            { data: ApiType.Achievements.Achievement },
            ApiType.Achievements.AchievementInput
        >({
            invalidatesTags: ['UserAchievements', 'AchievementsManage'],
            query: (body) => ({ body, method: 'POST', url: 'achievements' }),
            transformErrorResponse: extractErrorData
        }),
        updateAchievement: builder.mutation<
            { data: ApiType.Achievements.Achievement },
            { id: string; body: ApiType.Achievements.AchievementInput }
        >({
            invalidatesTags: ['UserAchievements', 'AchievementsManage'],
            query: ({ id, body }) => ({ body, method: 'PUT', url: `achievements/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        deleteAchievement: builder.mutation<void, string>({
            invalidatesTags: ['UserAchievements', 'AchievementsManage'],
            query: (id) => ({ method: 'DELETE', url: `achievements/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        uploadAchievementImage: builder.mutation<{ id: string; image: string }, { id: string; file: File }>({
            invalidatesTags: ['UserAchievements', 'AchievementsManage'],
            query: ({ id, file }) => {
                const formData = new FormData()
                formData.append('image', file)
                return { body: formData, method: 'POST', url: `achievements/${id}/image` }
            },
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Auth **/
        authGetMe: builder.query<ApiType.Auth.LoginResponse, void>({
            providesTags: ['Profile'],
            query: () => 'auth/me'
        }),
        authLoginService: builder.mutation<ApiType.Auth.LoginResponse, ApiType.Auth.PostLoginServiceRequest>({
            query: ({ service, ...params }) => `auth/${service}${params?.code ? encodeQueryData(params) : ''}`,
            transformErrorResponse: extractErrorMessage
        }),
        authPostLogin: builder.mutation<ApiType.Auth.LoginResponse, ApiType.Auth.PostLoginNativeRequest>({
            query: (credentials) => ({
                body: credentials,
                method: 'POST',
                url: 'auth/login'
            }),
            transformErrorResponse: extractErrorData
        }),
        authPostRegistration: builder.mutation<ApiType.Auth.LoginResponse, ApiType.Auth.PostRegistrationRequest>({
            query: (credentials) => ({
                body: credentials,
                method: 'POST',
                url: 'auth/registration'
            }),
            transformErrorResponse: extractErrorData
        }),
        authRequestMagicLink: builder.mutation<
            ApiType.Auth.PostMagicLinkRequestResponse,
            ApiType.Auth.PostMagicLinkRequest
        >({
            query: (body) => ({
                body,
                method: 'POST',
                url: 'auth/magic-link'
            }),
            transformErrorResponse: extractErrorData
        }),
        authVerifyMagicLink: builder.mutation<
            ApiType.Auth.MagicLinkVerifyResponse,
            ApiType.Auth.PostMagicLinkVerifyRequest
        >({
            query: (body) => ({
                body,
                method: 'POST',
                url: 'auth/magic-link/verify'
            }),
            transformErrorResponse: extractErrorMessage
        }),

        /** Controller: Bookmarks **/
        bookmarksGetPlace: builder.query<ApiType.Bookmarks.CheckResponse, ApiType.Bookmarks.Request>({
            providesTags: (res, err, arg) => [{ id: arg.placeId, type: 'Bookmarks' }],
            query: (params) => `bookmarks${encodeQueryData(params)}`
        }),
        bookmarksPutPlace: builder.mutation<void, ApiType.Bookmarks.Request>({
            invalidatesTags: (res, err, arg) => [{ id: arg.placeId, type: 'Bookmarks' }],
            query: (data) => ({
                body: data,
                method: 'PUT',
                url: 'bookmarks'
            }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Collections **/
        collectionsGetList: builder.query<ApiType.Collections.ListResponse, Maybe<ApiType.Collections.ListRequest>>({
            providesTags: ['Collections'],
            query: (params) => `collections${encodeQueryData(params)}`
        }),
        collectionsGetItem: builder.query<ApiType.Collections.ItemResponse, string>({
            providesTags: (result, error, id) => [{ id, type: 'Collections' }],
            query: (id) => `collections/${id}`
        }),
        collectionsPost: builder.mutation<ApiType.Collections.CreateResponse, ApiType.Collections.CreateRequest>({
            invalidatesTags: ['Collections', 'CollectionMembership'],
            query: (data) => ({
                body: data,
                method: 'POST',
                url: 'collections'
            }),
            transformErrorResponse: extractErrorData
        }),
        collectionsPatch: builder.mutation<void, ApiType.Collections.PatchRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.id, type: 'Collections' }],
            query: ({ id, ...body }) => ({
                body,
                method: 'PATCH',
                url: `collections/${id}`
            }),
            transformErrorResponse: extractErrorData
        }),
        collectionsDelete: builder.mutation<void, string>({
            invalidatesTags: ['Collections'],
            query: (id) => ({
                method: 'DELETE',
                url: `collections/${id}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        collectionsAddPlaces: builder.mutation<
            ApiType.Collections.AddPlacesResponse,
            ApiType.Collections.AddPlacesRequest
        >({
            invalidatesTags: (res, err, arg) => [
                { id: arg.id, type: 'Collections' },
                { type: 'CollectionMembership' },
                { type: 'Feed' },
                { type: 'Notifications' }
            ],
            query: ({ id, placeIds }) => ({
                body: { placeIds },
                method: 'PUT',
                url: `collections/${id}/places`
            }),
            transformErrorResponse: extractErrorData
        }),
        collectionsRemovePlace: builder.mutation<void, ApiType.Collections.RemovePlaceRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.id, type: 'Collections' }, { type: 'CollectionMembership' }],
            query: ({ id, placeId }) => ({
                method: 'DELETE',
                url: `collections/${id}/places/${placeId}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        collectionsReorderPlaces: builder.mutation<void, ApiType.Collections.ReorderRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.id, type: 'Collections' }],
            query: ({ id, ...body }) => ({
                body,
                method: 'PATCH',
                url: `collections/${id}/places`
            }),
            transformErrorResponse: extractErrorData
        }),
        collectionsGetMembership: builder.query<
            ApiType.Collections.MembershipResponse,
            Maybe<ApiType.Collections.MembershipRequest>
        >({
            providesTags: (result, error, arg) => [{ id: arg?.placeId ?? 'LIST', type: 'CollectionMembership' }],
            query: (params) => `collections/membership${encodeQueryData(params)}`
        }),
        collectionsGetRecommended: builder.query<
            ApiType.Collections.RecommendedResponse,
            ApiType.Collections.RecommendedRequest
        >({
            providesTags: (result, error, arg) => [{ id: arg.id, type: 'Collections' }],
            query: ({ id, limit }) => `collections/${id}/recommended${encodeQueryData({ limit })}`
        }),

        /** Controller: Categories v*/
        categoriesGetLocations: builder.query<
            ApiType.Locations.CategoryLocationsResponse,
            ApiType.Locations.CategoryLocationsRequest
        >({
            query: ({ name, ...params }) => `categories/${name}/locations${encodeQueryData(params)}`
        }),

        /** Controller: Comments **/
        commentsGetList: builder.query<ApiType.Comments.ListResponse, Maybe<ApiType.Comments.ListRequest>>({
            providesTags: ['Comments'],
            query: (params) => `comments${encodeQueryData(params)}`
        }),
        commentsPost: builder.mutation<void, ApiType.Comments.PostRequest>({
            invalidatesTags: () => ['Comments', 'Feed', 'Notifications'],
            query: (data) => ({
                body: data,
                method: 'POST',
                url: 'comments'
            }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Mailings (the newsletters of the admin) **/
        mailingsGetList: builder.query<
            ApiType.Mailings.MailingListResponse,
            Maybe<ApiType.Mailings.MailingListRequest>
        >({
            providesTags: ['Mailings'],
            query: (params) => `mailings/manage${encodeQueryData(params)}`
        }),
        mailingsGetItem: builder.query<ApiType.Mailings.MailingAdmin, string>({
            providesTags: (_result, _error, id) => [{ id, type: 'Mailings' }],
            query: (id) => `mailings/manage/${id}`
        }),
        mailingsGetAudience: builder.query<ApiType.Mailings.MailingAudience, void>({
            keepUnusedDataFor: 0,
            query: () => 'mailings/audience'
        }),
        mailingsPost: builder.mutation<ApiType.Mailings.MailingAdmin, ApiType.Mailings.MailingInput>({
            invalidatesTags: ['Mailings'],
            query: (body) => ({ body, method: 'POST', url: 'mailings' }),
            transformErrorResponse: extractErrorData
        }),
        mailingsPatch: builder.mutation<
            ApiType.Mailings.MailingAdmin,
            { id: string; body: ApiType.Mailings.MailingInput }
        >({
            invalidatesTags: ['Mailings'],
            query: ({ id, body }) => ({ body, method: 'PATCH', url: `mailings/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        mailingsDelete: builder.mutation<{ id: string }, string>({
            invalidatesTags: ['Mailings'],
            query: (id) => ({ method: 'DELETE', url: `mailings/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        mailingsPostImage: builder.mutation<ApiType.Mailings.MailingAdmin, { id: string; file: File }>({
            invalidatesTags: ['Mailings'],
            query: ({ id, file }) => {
                const formData = new FormData()
                formData.append('image', file)
                return { body: formData, method: 'POST', url: `mailings/${id}/image` }
            },
            transformErrorResponse: extractErrorData
        }),
        mailingsDeleteImage: builder.mutation<ApiType.Mailings.MailingAdmin, string>({
            invalidatesTags: ['Mailings'],
            query: (id) => ({ method: 'DELETE', url: `mailings/${id}/image` }),
            transformErrorResponse: extractErrorData
        }),
        mailingsPostPreview: builder.mutation<
            ApiType.Mailings.MailingPreviewResponse,
            ApiType.Mailings.MailingPreviewRequest
        >({
            query: (body) => ({ body, method: 'POST', url: 'mailings/preview' }),
            transformErrorResponse: extractErrorData
        }),
        mailingsPostTest: builder.mutation<ApiType.Mailings.MailingTestResponse, string>({
            query: (id) => ({ method: 'POST', url: `mailings/${id}/test` }),
            transformErrorResponse: extractErrorData
        }),
        mailingsPostSend: builder.mutation<ApiType.Mailings.MailingAdmin, string>({
            invalidatesTags: ['Mailings'],
            query: (id) => ({ method: 'POST', url: `mailings/${id}/send` }),
            transformErrorResponse: extractErrorData
        }),
        mailingsPostCancel: builder.mutation<ApiType.Mailings.MailingAdmin, string>({
            invalidatesTags: ['Mailings'],
            query: (id) => ({ method: 'POST', url: `mailings/${id}/cancel` }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Mail **/
        mailGetQueue: builder.query<ApiType.Mail.MailQueueResponse, void>({
            query: () => 'mail/queue'
        }),
        mailGetUnsubscribe: builder.query<
            ApiType.Mail.UnsubscribeStatusResponse,
            ApiType.Mail.UnsubscribeStatusRequest
        >({
            query: (params) => `mail/unsubscribe${encodeQueryData(params)}`,
            transformErrorResponse: extractErrorMessage
        }),
        mailPostUnsubscribe: builder.mutation<ApiType.Mail.UnsubscribeResponse, ApiType.Mail.UnsubscribeRequest>({
            invalidatesTags: ['Users'],
            query: (body) => ({
                body,
                method: 'POST',
                url: 'mail/unsubscribe'
            }),
            transformErrorResponse: extractErrorMessage
        }),

        /** Controller: Push **/
        pushGetKey: builder.query<ApiType.Push.KeyResponse, void>({
            query: () => 'push/key'
        }),
        pushGetStatus: builder.query<ApiType.Push.StatusResponse, string>({
            providesTags: ['PushStatus'],
            // A POST: the endpoint is a capability URL, it must not end up in access logs
            query: (endpoint) => ({ body: { endpoint }, method: 'POST', url: 'push/subscriptions/status' })
        }),
        pushPostSubscription: builder.mutation<void, ApiType.Push.SubscribeRequest>({
            invalidatesTags: ['PushStatus'],
            query: (body) => ({ body, method: 'POST', url: 'push/subscriptions' }),
            transformErrorResponse: extractErrorMessage
        }),
        pushDeleteSubscription: builder.mutation<void, string>({
            invalidatesTags: ['PushStatus'],
            query: (endpoint) => ({ body: { endpoint }, method: 'DELETE', url: 'push/subscriptions' }),
            transformErrorResponse: extractErrorMessage
        }),
        pushPostTest: builder.mutation<ApiType.Push.TestResponse, void>({
            query: () => ({ method: 'POST', url: 'push/test' }),
            transformErrorResponse: extractErrorMessage
        }),

        /** Controller: Game **/
        gameGet: builder.query<ApiType.Game.GetResponse, { rivals?: boolean } | void>({
            providesTags: ['Game'],
            // `rivals`: with the players right above and below the visitor (the home page's block)
            query: (params) => `game${params?.rivals ? '?rivals=1' : ''}`
        }),
        gameGetExploration: builder.query<ApiType.Game.ExplorationResponse, Maybe<{ user?: string }>>({
            providesTags: ['Game'],
            query: (params) => `game/exploration${encodeQueryData(params)}`
        }),
        gameGetLeaders: builder.query<ApiType.Game.LeadersResponse, Maybe<ApiType.Game.LeadersRequest>>({
            providesTags: ['Game'],
            query: (params) => `game/leaders${encodeQueryData(params)}`
        }),
        gameGetMine: builder.query<ApiType.Game.MineResponse, Maybe<{ limit?: number; offset?: number }>>({
            providesTags: ['Game'],
            query: (params) => `game/mine${encodeQueryData(params)}`
        }),
        gameGetPlaces: builder.query<ApiType.Game.PlacesResponse, Maybe<ApiType.Game.PlacesRequest>>({
            providesTags: ['Game'],
            query: (params) => `game/places${encodeQueryData(params)}`
        }),
        gameGetSeasonManage: builder.query<ApiType.Game.SeasonAdmin, string>({
            providesTags: (_result, _error, id) => [{ id, type: 'GameSeasons' }],
            query: (id) => `game/seasons/manage/${id}`
        }),
        gamePostSeason: builder.mutation<ApiType.Game.SeasonAdmin, ApiType.Game.SeasonInput>({
            invalidatesTags: ['Game'],
            query: (body) => ({ body, method: 'POST', url: 'game/seasons' }),
            transformErrorResponse: extractErrorData
        }),
        gamePatchSeason: builder.mutation<ApiType.Game.SeasonAdmin, { id: string; body: ApiType.Game.SeasonInput }>({
            invalidatesTags: (_result, _error, { id }) => [{ id, type: 'GameSeasons' }, 'Game'],
            query: ({ id, body }) => ({ body, method: 'PATCH', url: `game/seasons/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        // Not its own tag: the deleted season's query would refetch into a 404 while its page is being left
        gameDeleteSeason: builder.mutation<void, string>({
            invalidatesTags: ['Game'],
            query: (id) => ({ method: 'DELETE', url: `game/seasons/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        gamePostSeasonImage: builder.mutation<
            ApiType.Game.SeasonAdmin,
            { id: string; kind: ApiType.Game.SeasonImageKind; file: File }
        >({
            invalidatesTags: (_result, _error, { id }) => [{ id, type: 'GameSeasons' }, 'Game'],
            query: ({ id, kind, file }) => {
                const formData = new FormData()
                formData.append('image', file)
                formData.append('kind', kind)
                return { body: formData, method: 'POST', url: `game/seasons/${id}/image` }
            },
            transformErrorResponse: extractErrorData
        }),
        gameDeleteSeasonImage: builder.mutation<
            ApiType.Game.SeasonAdmin,
            { id: string; kind: ApiType.Game.SeasonImageKind }
        >({
            invalidatesTags: (_result, _error, { id }) => [{ id, type: 'GameSeasons' }, 'Game'],
            query: ({ id, kind }) => ({ method: 'DELETE', url: `game/seasons/${id}/image?kind=${kind}` }),
            transformErrorResponse: extractErrorData
        }),
        gameGetSeason: builder.query<ApiType.Game.SeasonResponse, string>({
            providesTags: ['Game'],
            query: (id) => `game/seasons/${id}`
        }),
        gameGetUser: builder.query<ApiType.Game.UserResponse, string>({
            providesTags: ['Game'],
            query: (id) => `game/users/${id}`
        }),
        /** A person's tasks: the limited awards running now, with their progress */
        gameGetUserTasks: builder.query<{ data: ApiType.Game.LimitedAward[] }, string>({
            providesTags: ['Game', 'UserAchievements'],
            query: (id) => `game/users/${id}/tasks`
        }),

        /** Controller: Quests (the quests of the game) **/
        questsDelete: builder.mutation<void, string>({
            invalidatesTags: ['Quests', 'Game'],
            query: (id) => ({ method: 'DELETE', url: `game/quests/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        questsGetItem: builder.query<ApiType.Game.QuestResponse, ApiType.Game.QuestGetRequest>({
            providesTags: (res, err, arg) => [{ id: arg.id, type: 'Quests' }],
            query: ({ id, edit }) => `game/quests/${id}${edit ? '?edit=1' : ''}`
        }),
        questsGetMarks: builder.query<ApiType.Game.QuestMarksResponse, void>({
            providesTags: ['Quests'],
            query: () => 'game/quests/marks'
        }),
        questsGetList: builder.query<ApiType.Game.QuestsListResponse, Maybe<ApiType.Game.QuestsListRequest>>({
            providesTags: ['Quests'],
            query: (params) => `game/quests${encodeQueryData(params)}`
        }),
        questsPatch: builder.mutation<{ id: string; slug: string | null }, ApiType.Game.QuestInput & { id: string }>({
            invalidatesTags: ['Quests', 'Game'],
            query: ({ id, ...body }) => ({ body, method: 'PATCH', url: `game/quests/${id}` }),
            transformErrorResponse: extractErrorData
        }),
        questsPost: builder.mutation<{ id: string; slug: string | null }, ApiType.Game.QuestInput>({
            invalidatesTags: ['Quests', 'Game'],
            query: (body) => ({ body, method: 'POST', url: 'game/quests' }),
            transformErrorResponse: extractErrorData
        }),
        questsPostMedal: builder.mutation<{ medal: string }, { id: string; file: File }>({
            invalidatesTags: (_res, _err, { id }) => [{ id, type: 'Quests' }, 'Quests'],
            query: ({ id, file }) => {
                const formData = new FormData()
                formData.append('image', file)
                return { body: formData, method: 'POST', url: `game/quests/${id}/medal` }
            },
            transformErrorResponse: extractErrorData
        }),
        questsDeleteMedal: builder.mutation<{ medal: null }, string>({
            invalidatesTags: (_res, _err, id) => [{ id, type: 'Quests' }, 'Quests'],
            query: (id) => ({ method: 'DELETE', url: `game/quests/${id}/medal` }),
            transformErrorResponse: extractErrorData
        }),
        questsPostConfirm: builder.mutation<ApiType.Game.QuestConfirmResponse, ApiType.Game.QuestConfirmRequest>({
            // A confirmed point is a confirmed visit of its place
            invalidatesTags: (res) => [
                { type: 'Quests' },
                { type: 'Game' },
                { type: 'Visits' },
                { type: 'Feed' },
                { type: 'Notifications' },
                { type: 'UserAchievements' },
                ...(res?.place ? [{ id: `me-${res.place}`, type: 'Visits' as const }] : [])
            ],
            query: ({ id, ...body }) => ({ body, method: 'POST', url: `game/quests/${id}/confirm` }),
            transformErrorResponse: extractErrorData
        }),
        questsDeleteWalk: builder.mutation<void, string>({
            invalidatesTags: ['Quests'],
            query: (id) => ({ method: 'DELETE', url: `game/quests/${id}/walk` }),
            transformErrorResponse: extractErrorData
        }),
        questsPostStart: builder.mutation<ApiType.Game.QuestWalk, string>({
            invalidatesTags: ['Quests'],
            query: (id) => ({ method: 'POST', url: `game/quests/${id}/start` }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Location **/
        locationGetByType: builder.query<ApiType.Location.GetByTypeResponse, ApiType.Location.GetByTypeRequest>({
            query: (params) => `location/${params.id}?type=${params.type}`
        }),
        locationGetSearch: builder.mutation<ApiType.Location.SearchResponse, Maybe<string>>({
            query: (searchString) => `location/search?text=${searchString || ''}`
        }),
        locationPutCoordinates: builder.mutation<void, Maybe<ApiType.Coordinates>>({
            query: (params) => ({
                body: params,
                method: 'PUT',
                url: 'location'
            })
        }),

        /** Controller: Locations — the landing-page API (features/20-location-seo-pages.md) **/
        locationsResolve: builder.query<ApiType.Locations.ResolveResponse, ApiType.Locations.ResolveRequest>({
            query: (params) => `locations/resolve${encodeQueryData(params)}`
        }),
        locationsGetCategories: builder.query<
            ApiType.Locations.CategoriesResponse,
            ApiType.Locations.LocationTypeIdRequest
        >({
            query: ({ type, id }) => `locations/${type}/${id}/categories`
        }),
        locationsGetChildren: builder.query<
            ApiType.Locations.ChildrenResponse,
            ApiType.Locations.LocationTypeIdRequest
        >({
            query: ({ type, id }) => `locations/${type}/${id}/children`
        }),
        locationsGetSummary: builder.query<ApiType.Locations.SummaryResponse, ApiType.Locations.LocationTypeIdRequest>({
            query: ({ type, id }) => `locations/${type}/${id}/summary`
        }),

        /** Controller: Notifications **/
        notificationsDelete: builder.mutation<void, void>({
            invalidatesTags: ['Notifications'],
            query: () => ({
                method: 'DELETE',
                url: 'notifications'
            })
        }),
        notificationsGetList: builder.infiniteQuery<ApiType.Notifications.ListResponse, void, string>({
            infiniteQueryOptions: {
                getNextPageParam: (lastPage) => lastPage.next ?? undefined,
                initialPageParam: '',
                // A refetch (opening the list again, an invalidation) starts over from the newest page
                refetchCachedPages: false
            },
            providesTags: ['Notifications'],
            query: ({ pageParam }) =>
                `notifications/list${encodeQueryData({ cursor: pageParam, limit: NOTIFICATIONS_PAGE_SIZE })}`
        }),
        notificationsGetUpdates: builder.query<ApiType.Notifications.ListResponse, void>({
            providesTags: ['Notifications'],
            query: () => 'notifications/updates'
        }),
        /** Not an invalidation: the open list keeps showing what was new, only the badge changes */
        notificationsPatchRead: builder.mutation<
            ApiType.Notifications.ReadResponse,
            Maybe<ApiType.Notifications.ReadRequest>
        >({
            onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
                try {
                    const { data } = await queryFulfilled

                    dispatch(
                        API.util.updateQueryData('notificationsGetUpdates', undefined, (draft) => {
                            draft.count = data.count
                        })
                    )
                } catch {
                    // The badge catches up on the next poll
                }
            },
            query: (body) => ({
                body: body ?? {},
                method: 'PATCH',
                url: 'notifications/read'
            })
        }),

        /** Controller: Exploration **/
        explorationGetPoints: builder.query<ApiType.Exploration.PointsResponse, void>({
            // The answer is the same for everybody and the server keeps it for 10 minutes too: a zoom
            // into the points and back must not fetch and parse the 400 KB again
            keepUnusedDataFor: 600,
            query: () => 'exploration/points'
        }),

        /** Controller: OSM Candidates **/
        osmCandidatesGetList: builder.query<ApiType.OsmCandidates.ListResponse, ApiType.OsmCandidates.ListRequest>({
            providesTags: ['OsmCandidates'],
            query: (params) => `osm-candidates${encodeQueryData(params)}`
        }),
        osmCandidatesGetItem: builder.query<ApiType.OsmCandidates.Candidate, string>({
            providesTags: (res, err, id) => [{ id, type: 'OsmCandidates' }],
            query: (id) => `osm-candidates/${id}`
        }),

        /** Controller: ExternalPhotos (Wikimedia Commons and PastVu photos linked to places) **/
        externalPhotosGetList: builder.query<ApiType.ExternalPhotos.ListResponse, ApiType.ExternalPhotos.ListRequest>({
            providesTags: (result, error, arg) => [{ id: arg.place ?? 'bounds', type: 'ExternalPhotos' }],
            query: (params) => `external-photos${encodeQueryData(params)}`
        }),
        externalPhotosPostLink: builder.mutation<
            ApiType.ExternalPhotos.CreateResponse,
            ApiType.ExternalPhotos.CreateRequest
        >({
            invalidatesTags: (res, err, arg) => [
                { id: arg.placeId, type: 'ExternalPhotos' },
                { id: 'bounds', type: 'ExternalPhotos' },
                { id: arg.placeId, type: 'Photos' },
                // Linking may give a place its cover, unlinking the cover source rebuilds it
                { id: arg.placeId, type: 'Places' }
            ],
            query: (body) => ({ body, method: 'POST', url: 'external-photos' }),
            transformErrorResponse: extractErrorMessage
        }),
        externalPhotosDeleteLink: builder.mutation<
            ApiType.ExternalPhotos.DeleteResponse,
            ApiType.ExternalPhotos.DeleteRequest
        >({
            invalidatesTags: (res, err, arg) => [
                { id: arg.placeId, type: 'ExternalPhotos' },
                { id: 'bounds', type: 'ExternalPhotos' },
                { id: arg.placeId, type: 'Photos' },
                // Linking may give a place its cover, unlinking the cover source rebuilds it
                { id: arg.placeId, type: 'Places' }
            ],
            query: ({ id }) => ({ method: 'DELETE', url: `external-photos/${id}` }),
            transformErrorResponse: extractErrorMessage
        }),

        /** Controller: Feed **/
        feedGetList: builder.infiniteQuery<ApiType.Feed.ListResponse, ApiType.Feed.ListRequest, string>({
            infiniteQueryOptions: {
                getNextPageParam: (lastPage) => lastPage.next ?? undefined,
                initialPageParam: ''
            },
            providesTags: (result, error, arg) => [{ id: arg?.author || arg?.place || 'LIST', type: 'Feed' }],
            query: ({ pageParam, queryArg }) => `feed${encodeQueryData({ ...queryArg, cursor: pageParam })}`
        }),
        /** One page without paging: the home page widget, the count of the place history (`countOnly`) */
        feedGetStories: builder.query<ApiType.Feed.ListResponse, ApiType.Feed.ListRequest>({
            providesTags: (result, error, arg) => [{ id: arg?.author || arg?.place || 'LIST', type: 'Feed' }],
            query: (params) => `feed${encodeQueryData(params)}`
        }),
        feedGetPulse: builder.query<ApiType.Feed.PulseResponse, void>({
            providesTags: [{ id: 'PULSE', type: 'Feed' }],
            query: () => 'feed/pulse'
        }),
        feedGetCalendar: builder.query<ApiType.Feed.CalendarResponse, ApiType.Feed.CalendarRequest>({
            providesTags: (result, error, arg) => [{ id: arg.author, type: 'Feed' }],
            query: (params) => `feed/calendar${encodeQueryData(params)}`
        }),

        /** Controller: Photos **/
        photoDeleteItem: builder.mutation<ApiType.Photos.DeleteResponse, ApiType.Photos.DeleteRequest>({
            // The request has no place: every list of photos (the cover picker, the profile, a visit's photos)
            invalidatesTags: (res, err, arg) =>
                arg?.temporary ? [] : [{ type: 'Photos' }, { type: 'Visits' }, { type: 'Feed' }],
            query: (params) => ({
                method: 'DELETE',
                url: `photos/${params?.temporary ? 'temporary/' : ''}${params?.id}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        photoPostUpload: builder.mutation<ApiType.Photos.UploadResponse, ApiType.Photos.UploadRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.place, type: 'Photos' },
                // A photo uploaded on the day of a visit shows in the visit
                { id: arg.place, type: 'Visits' },
                { type: 'Feed' },
                { type: 'Notifications' },
                // A photo shot at the place confirmed a visit: the button, the season, the quests
                ...(res?.game
                    ? [
                          { id: `me-${arg.place}`, type: 'Visits' as const },
                          { type: 'Game' as const },
                          { type: 'Quests' as const },
                          { type: 'UserAchievements' as const }
                      ]
                    : [])
            ],
            query: (data) => ({
                body: data.formData,
                method: 'POST',
                url: `photos/upload/${data.place}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        photoRotateItem: builder.mutation<ApiType.Photos.RotateResponse, ApiType.Photos.RotateRequest>({
            query: (params) => ({
                method: 'PATCH',
                url: `photos/rotate/${params?.temporary ? 'temporary/' : ''}${params?.id}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        photosGetList: builder.query<ApiType.Photos.ListResponse, Maybe<ApiType.Photos.ListRequest>>({
            providesTags: (result, error, arg) => [{ id: arg?.place || arg?.author, type: 'Photos' }],
            query: (params) => `photos${encodeQueryData(params)}`
        }),

        /** Controller: Places **/
        placesGetItem: builder.query<ApiType.Places.ItemResponse, ApiType.Places.ItemRequest>({
            providesTags: (result, error, arg) => [{ id: arg.id, type: 'Places' }],
            query: (params) =>
                `places/${params.id}${encodeQueryData({
                    ...params,
                    id: undefined
                })}`
        }),
        /** Counts a view of the place page: the page comes from the cache, GET /places/:id counts none */
        placesPostView: builder.mutation<ApiType.Places.PostViewResponse, string>({
            query: (id) => ({
                method: 'POST',
                url: `places/${id}/views`
            })
        }),
        placesGetTexts: builder.query<ApiType.Places.TextsResponse, string>({
            providesTags: (result, error, id) => [{ id, type: 'Places' }],
            query: (id) => `places/${id}/texts`
        }),
        placesGetList: builder.query<ApiType.Places.ListResponse, Maybe<ApiType.Places.ListRequest>>({
            providesTags: ['Places'],
            query: (params) => `places${encodeQueryData(params)}`
        }),
        placesPatchCover: builder.mutation<void, ApiType.Places.PatchCoverRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.placeId, type: 'Places' },
                { type: 'Feed' },
                { type: 'Notifications' }
            ],
            query: (data) => ({
                body: data,
                method: 'PATCH',
                url: `places/cover/${data.placeId}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        placeDelete: builder.mutation<void, string>({
            // The place is gone from every list, map, feed and collection it was in
            invalidatesTags: [
                { type: 'Places' },
                { type: 'Photos' },
                { type: 'Feed' },
                { type: 'Bookmarks' },
                { type: 'Visits' },
                { type: 'Collections' },
                { type: 'Notifications' },
                { type: 'OsmCandidates' }
            ],
            query: (id) => ({
                method: 'DELETE',
                url: `places/${id}`
            })
        }),
        placesPatchItem: builder.mutation<ApiType.Places.PatchItemResponse, ApiType.Places.PostItemRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.id, type: 'Places' },
                { type: 'Feed' },
                { type: 'Notifications' }
            ],
            query: (data) => ({
                body: data,
                method: 'PATCH',
                url: `places/${data.id}`
            }),
            transformErrorResponse: extractErrorData
        }),
        placesPostItem: builder.mutation<ApiType.Places.PostItemResponse, Omit<ApiType.Places.PostItemRequest, 'id'>>({
            invalidatesTags: [
                { type: 'Places' },
                { type: 'Feed' },
                { type: 'Notifications' },
                { type: 'OsmCandidates' }
            ],
            query: (data) => ({
                body: data,
                method: 'POST',
                url: 'places'
            }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: POI **/
        poiGetItem: builder.query<ApiType.POI.PoiItemResponse, ApiType.POI.PoiItemRequest>({
            // The popup shows the bookmark state and counter: refetch it when the bookmark is toggled
            providesTags: (res, err, { id }) => [{ id, type: 'Bookmarks' }],
            query: ({ id, ...params }) => `poi/${id}${encodeQueryData(params)}`
        }),
        poiGetList: builder.query<ApiType.POI.PlacesListResponse, Maybe<ApiType.POI.ListRequest>>({
            // The visitor's own visited places (the green cells of the hex layer) follow their check-ins,
            // a person's bookmarks (their map on the profile) follow the bookmark toggles
            providesTags: (res, err, arg) => [
                ...(arg?.visited ? [{ type: 'Visits' as const }] : []),
                ...(arg?.bookmarks ? [{ id: 'LIST', type: 'Bookmarks' as const }] : [])
            ],
            query: (params) => `poi${encodeQueryData(params)}`
        }),
        poiGetPhotoList: builder.query<
            ApiType.POI.PhotosListResponse,
            Maybe<Omit<ApiType.POI.ListRequest, 'categories'>>
        >({
            query: (params) => `poi/photos${encodeQueryData(params)}`
        }),

        /** Controller: Search **/
        search: builder.query<ApiType.Search.Response, ApiType.Search.Request>({
            query: (params) => ({ params, url: 'search' }),
            keepUnusedDataFor: 60
        }),
        searchSuggest: builder.query<ApiType.Search.SuggestResponse, string>({
            query: (q) => ({ params: { q }, url: 'search/suggest' }),
            keepUnusedDataFor: 30
        }),

        /** Controller: Rating **/
        ratingGetList: builder.query<ApiType.Rating.ListResponse, string>({
            providesTags: ['Rating'],
            query: (item) => `rating/${item}`
        }),
        ratingPutScore: builder.mutation<ApiType.Rating.PutResponse, ApiType.Rating.PutRequest>({
            invalidatesTags: [{ type: 'Rating' }, { type: 'Feed' }, { type: 'Notifications' }],
            query: (data) => ({
                body: data,
                method: 'PUT',
                url: 'rating'
            }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Sitemap **/
        sitemapGetList: builder.query<ApiType.SiteMap.Response, void>({
            query: () => 'sitemap'
        }),

        /** Controller: Stats **/
        statsGetSummary: builder.query<ApiType.Stats.GetResponse, void>({
            query: () => 'stats'
        }),

        /** Controller: User **/
        usersGetItem: builder.query<ApiType.Users.ItemResponse, string>({
            providesTags: ['Users'],
            query: (item) => `users/${item}`
        }),
        /** The history of a reputation, newest first: a scrolling list */
        usersGetReputation: builder.infiniteQuery<
            ApiType.Users.ReputationResponse,
            ApiType.Users.ReputationRequest,
            string
        >({
            infiniteQueryOptions: {
                getNextPageParam: (lastPage) => lastPage.next ?? undefined,
                initialPageParam: ''
            },
            // A score moves it
            providesTags: (result, error, arg) => [{ id: `reputation-${arg.id}`, type: 'Rating' }],
            query: ({ pageParam, queryArg }) =>
                `users/${queryArg.id}/reputation${encodeQueryData({ cursor: pageParam || undefined })}`
        }),
        usersGetList: builder.query<ApiType.Users.ListResponse, Maybe<ApiType.Users.ListRequest>>({
            providesTags: ['Users'],
            query: (params) => `users${encodeQueryData(params)}`
        }),
        usersPatchCropAvatar: builder.mutation<ApiType.Users.CropAvatarResponse, ApiType.Users.CropAvatarRequest>({
            invalidatesTags: () => ['Users', 'Profile'],
            query: (data) => ({
                body: data,
                method: 'PATCH',
                url: 'users/crop'
            }),
            transformErrorResponse: extractErrorData
        }),
        usersPatchProfile: builder.mutation<void, ApiType.Users.PatchRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.id, type: 'Users' }, { type: 'Users' }],
            query: (data) => ({
                body: data,
                method: 'PATCH',
                url: `users/${data.id}`
            }),
            transformErrorResponse: extractErrorData
        }),
        usersPostUploadAvatar: builder.mutation<ApiType.Users.UploadAvatarResponse, { formData: FormData }>({
            query: (data) => ({
                body: data.formData,
                method: 'POST',
                url: 'users/avatar'
            }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Visits **/
        visitsDelete: builder.mutation<void, ApiType.Visits.DeleteRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.place, type: 'Visits' },
                { id: arg.place, type: 'Photos' },
                { type: 'Visits' },
                { type: 'Feed' },
                { type: 'Notifications' },
                // The geopoints of a visit go with it
                { type: 'Game' }
            ],
            query: ({ id }) => ({
                method: 'DELETE',
                url: `visits/${id}`
            }),
            transformErrorResponse: extractErrorData
        }),
        visitsGetList: builder.query<ApiType.Visits.ListResponse, ApiType.Visits.ListRequest>({
            providesTags: (res, err, arg) => [{ id: arg.place ?? arg.user, type: 'Visits' }],
            query: (params) => `visits${encodeQueryData(params)}`
        }),
        visitsGetMe: builder.query<ApiType.Visits.MeResponse, ApiType.Visits.MeRequest>({
            providesTags: (res, err, arg) => [{ id: `me-${arg.place}`, type: 'Visits' }],
            query: (params) => `visits/me${encodeQueryData(params)}`
        }),
        visitsGetPlaces: builder.query<ApiType.Visits.PlacesResponse, ApiType.Visits.PlacesRequest>({
            providesTags: (res, err, arg) => [{ id: arg.user, type: 'Visits' }],
            query: (params) => `visits/places${encodeQueryData(params)}`
        }),
        visitsPatch: builder.mutation<ApiType.Visits.UpdateResponse, ApiType.Visits.UpdateRequest>({
            // An answer changes the place's "how it is now" and the visitor's own visit: the lists of
            // other places and the profile timelines are left alone (a tap is one PATCH and two GETs)
            invalidatesTags: (res, err, arg) => [
                { id: arg.place, type: 'Visits' },
                { id: `me-${arg.place}`, type: 'Visits' }
            ],
            query: ({ id, answers }) => ({
                body: { answers },
                method: 'PATCH',
                url: `visits/${id}`
            }),
            transformErrorResponse: extractErrorData
        }),
        visitsPost: builder.mutation<ApiType.Visits.CreateResponse, ApiType.Visits.CreateRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.place, type: 'Visits' },
                { id: `me-${arg.place}`, type: 'Visits' },
                { type: 'Visits' },
                { type: 'Feed' },
                { type: 'Notifications' },
                // A check-in on the spot counts the place in the season, and is a point of a quest
                ...(res?.game?.confirmed
                    ? [{ type: 'Game' as const }, { type: 'Quests' as const }, { type: 'UserAchievements' as const }]
                    : [])
            ],
            query: (data) => ({
                body: data,
                method: 'POST',
                url: 'visits'
            }),
            transformErrorResponse: extractErrorData
        })
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractRehydrationInfo(action, { reducerPath }): any {
        if (isHydrateAction(action)) {
            return action?.payload?.[reducerPath]
        }
    },
    reducerPath: 'api',
    tagTypes: [
        'AchievementsManage',
        'Bookmarks',
        'CollectionMembership',
        'Collections',
        'Comments',
        'ExternalPhotos',
        'Feed',
        'Game',
        'GameSeasons',
        'Mailings',
        'Notifications',
        'OsmCandidates',
        'Photos',
        'Places',
        'Profile',
        'PushStatus',
        'Rating',
        'Quests',
        'UserAchievements',
        'Users',
        'Visits'
    ]
})
