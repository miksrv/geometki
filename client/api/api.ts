import { HYDRATE } from 'next-redux-wrapper'
import type { Action, PayloadAction } from '@reduxjs/toolkit'
import { createApi, fetchBaseQuery, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'

import { ApiType } from '@/api'
import { RootState } from '@/app/store'
import { API_HOST } from '@/config/env'
import { encodeQueryData } from '@/utils/url'

type Maybe<T> = T | void

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
        prepareHeaders: (headers, { getState }) => {
            // By default, if we have a token in the store, let's use that for authenticated requests
            const token = (getState() as RootState).auth.token
            const session = (getState() as RootState).auth.session
            const locale = (getState() as RootState).application.locale

            if (token) {
                headers.set('Authorization', token)
            }

            if (session) {
                headers.set('Session', session)
            }

            if (locale) {
                headers.set('Locale', locale)
            }

            return headers
        }
    }),
    endpoints: (builder) => ({
        /** Controller: Achievements **/
        getAchievements: builder.query<
            { data: ApiType.Achievements.Achievement[] },
            ApiType.Achievements.GetAchievementsParams | void
        >({
            providesTags: ['Achievements'],
            query: (params) => ({ params: params ?? undefined, url: 'achievements' })
        }),
        getUserAchievements: builder.query<{ data: ApiType.Achievements.Achievement[] }, string>({
            providesTags: ['UserAchievements'],
            query: (userId) => `users/${userId}/achievements`
        }),
        getAchievementsProgress: builder.query<
            { data: Record<string, ApiType.Achievements.AchievementProgress> },
            void
        >({
            providesTags: ['AchievementsProgress'],
            query: () => 'achievements/progress'
        }),
        getAchievementsManage: builder.query<{ data: ApiType.Achievements.AchievementAdmin[] }, void>({
            providesTags: ['AchievementsManage'],
            query: () => 'achievements/manage'
        }),
        createAchievement: builder.mutation<
            { data: ApiType.Achievements.Achievement },
            ApiType.Achievements.AchievementInput
        >({
            invalidatesTags: ['Achievements', 'AchievementsManage'],
            query: (body) => ({ body, method: 'POST', url: 'achievements' })
        }),
        updateAchievement: builder.mutation<
            { data: ApiType.Achievements.Achievement },
            { id: string; body: ApiType.Achievements.AchievementInput }
        >({
            invalidatesTags: ['Achievements', 'AchievementsManage'],
            query: ({ id, body }) => ({ body, method: 'PUT', url: `achievements/${id}` })
        }),
        deleteAchievement: builder.mutation<void, string>({
            invalidatesTags: ['Achievements', 'AchievementsManage'],
            query: (id) => ({ method: 'DELETE', url: `achievements/${id}` })
        }),
        uploadAchievementImage: builder.mutation<{ id: string; image: string }, { id: string; file: File }>({
            invalidatesTags: ['Achievements', 'AchievementsManage'],
            query: ({ id, file }) => {
                const formData = new FormData()
                formData.append('image', file)
                return { body: formData, method: 'POST', url: `achievements/${id}/image` }
            }
        }),

        /** Controller: Activity **/
        activityGetInfinityList: builder.query<
            ApiType.Activity.GetListResponse,
            Maybe<ApiType.Activity.GetListRequest>
        >({
            forceRefetch: ({ currentArg, previousArg }) => currentArg !== previousArg,
            merge: (currentCache, newItems, { arg }) => {
                if (arg?.date) {
                    currentCache.items.push(...newItems.items)
                } else {
                    currentCache.items = newItems.items
                }
            },
            providesTags: (result, error, arg) => [{ id: arg?.author || arg?.place || 'LIST', type: 'Activity' }],
            query: (params) => `activity${encodeQueryData(params)}`,
            serializeQueryArgs: ({ endpointName, queryArgs }) => {
                if (queryArgs?.author) {
                    return `${endpointName}_author_${queryArgs.author}`
                }
                if (queryArgs?.place) {
                    return `${endpointName}_place_${queryArgs.place}`
                }
                return endpointName
            }
        }),
        activityGetList: builder.query<ApiType.Activity.GetListResponse, Maybe<ApiType.Activity.GetListRequest>>({
            providesTags: (result, error, arg) => [{ id: arg?.place || arg?.author, type: 'Activity' }],
            query: (params) => `activity${encodeQueryData(params)}`
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
        collectionsPatchModeration: builder.mutation<void, ApiType.Collections.ModerationRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.id, type: 'Collections' }],
            query: ({ id, ...body }) => ({
                body,
                method: 'PATCH',
                url: `collections/${id}/moderation`
            }),
            transformErrorResponse: extractErrorData
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
            invalidatesTags: () => ['Comments', 'Notifications'],
            query: (data) => ({
                body: data,
                method: 'POST',
                url: 'comments'
            }),
            transformErrorResponse: extractErrorData
        }),

        /** Controller: Sending Mail **/
        getSendingMailList: builder.query<
            ApiType.SendingMail.SendingMailListResponse,
            Maybe<ApiType.SendingMail.SendingMailListRequest>
        >({
            providesTags: ['SendingMail'],
            query: (params) => `sending-mail/manage${encodeQueryData(params)}`
        }),

        getSendingMailItem: builder.query<ApiType.SendingMail.SendingMailDetailResponse, string>({
            providesTags: (result, error, id) => [{ id, type: 'SendingMail' }],
            query: (id) => `sending-mail/manage/${id}`
        }),

        /** Controller: Mail **/
        mailGetUnsubscribe: builder.query<string, Maybe<string>>({
            query: (mailId) => `mail/unsubscribe?mail=${mailId || ''}`,
            transformErrorResponse: extractErrorMessage
        }),
        mailGetUnsubscribeDigest: builder.query<string, Maybe<string>>({
            query: (userId) => `mail/unsubscribe?digest=${userId || ''}`,
            transformErrorResponse: extractErrorMessage
        }),

        /** Controller: Location **/
        locationGetByType: builder.query<ApiType.Location.GetByTypeResponse, ApiType.Location.GetByTypeRequest>({
            query: (params) => `location/${params.id}?type=${params.type}`
        }),
        locationGetGeoSearch: builder.mutation<ApiType.Location.GeoSearchResponse, Maybe<string>>({
            query: (searchString) => `location/geosearch?text=${searchString || ''}`
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
        notificationsGetList: builder.query<
            ApiType.Notifications.ListResponse,
            Maybe<ApiType.Notifications.ListRequest>
        >({
            forceRefetch: ({ currentArg, previousArg }) => currentArg?.offset !== previousArg?.offset,
            merge: (currentCache, newItems, { arg }) => {
                const isFirstPage = (arg?.offset as number) === 0

                if (isFirstPage) {
                    currentCache.items = newItems.items ?? []
                    currentCache.count = newItems.count
                } else {
                    const existingIds = new Set(currentCache.items?.map((i) => i.id))
                    const fresh = (newItems.items ?? []).filter((i) => !existingIds.has(i.id))
                    currentCache.items?.push(...fresh)
                }
            },
            providesTags: ['Notifications'],
            query: (params) => `notifications/list${encodeQueryData(params)}`,
            serializeQueryArgs: ({ endpointName }) => endpointName
        }),
        notificationsGetUpdates: builder.query<ApiType.Notifications.ListResponse, void>({
            providesTags: ['Notifications'],
            query: () => 'notifications/updates'
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
        osmCandidatesPatchLink: builder.mutation<void, ApiType.OsmCandidates.LinkRequest>({
            invalidatesTags: ['OsmCandidates'],
            query: ({ id, placeId }) => ({ body: { placeId }, method: 'PATCH', url: `osm-candidates/${id}/link` }),
            transformErrorResponse: extractErrorMessage
        }),
        osmCandidatesPatchUnlink: builder.mutation<void, string>({
            invalidatesTags: ['OsmCandidates'],
            query: (id) => ({ method: 'PATCH', url: `osm-candidates/${id}/unlink` }),
            transformErrorResponse: extractErrorMessage
        }),
        osmCandidatesPatchReject: builder.mutation<void, string>({
            invalidatesTags: ['OsmCandidates'],
            query: (id) => ({ method: 'PATCH', url: `osm-candidates/${id}/reject` }),
            transformErrorResponse: extractErrorMessage
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
                { id: arg.placeId, type: 'Photos' }
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
                { id: arg.placeId, type: 'Photos' }
            ],
            query: ({ id }) => ({ method: 'DELETE', url: `external-photos/${id}` }),
            transformErrorResponse: extractErrorMessage
        }),

        /** Controller: Photos **/
        photoDeleteItem: builder.mutation<ApiType.Photos.DeleteResponse, ApiType.Photos.DeleteRequest>({
            query: (params) => ({
                method: 'DELETE',
                url: `photos/${params?.temporary ? 'temporary/' : ''}${params?.id}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        photoPostUpload: builder.mutation<ApiType.Photos.UploadResponse, ApiType.Photos.UploadRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.place, type: 'Photos' },
                { id: arg.place, type: 'Activity' },
                { type: 'Notifications' }
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
        placesGetList: builder.query<ApiType.Places.ListResponse, Maybe<ApiType.Places.ListRequest>>({
            providesTags: ['Places'],
            query: (params) => `places${encodeQueryData(params)}`
        }),
        placesPatchCover: builder.mutation<void, ApiType.Places.PatchCoverRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.placeId, type: 'Places' }, { type: 'Notifications' }],
            query: (data) => ({
                body: data,
                method: 'PATCH',
                url: `places/cover/${data.placeId}`
            }),
            transformErrorResponse: extractErrorMessage
        }),
        placeDelete: builder.mutation<void, string>({
            query: (id) => ({
                method: 'DELETE',
                url: `places/${id}`
            })
        }),
        placesPatchItem: builder.mutation<ApiType.Places.PatchItemResponse, ApiType.Places.PostItemRequest>({
            invalidatesTags: (res, err, arg) => [
                { id: arg.id, type: 'Places' },
                { type: 'Activity' },
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
                { type: 'Activity' },
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
        poiGetItem: builder.query<ApiType.POI.PoiItemResponse, string>({
            // The popup shows the bookmark state and counter: refetch it when the bookmark is toggled
            providesTags: (res, err, id) => [{ id, type: 'Bookmarks' }],
            query: (item) => `poi/${item}`
        }),
        poiGetList: builder.query<ApiType.POI.PlacesListResponse, Maybe<ApiType.POI.ListRequest>>({
            query: (params) => `poi${encodeQueryData(params)}`
        }),
        poiGetPhotoList: builder.query<
            ApiType.POI.PhotosListResponse,
            Maybe<Omit<ApiType.POI.ListRequest, 'categories'>>
        >({
            query: (params) => `poi/photos${encodeQueryData(params)}`
        }),
        poiGetUsers: builder.query<ApiType.POI.UsersListResponse, void>({
            query: () => 'poi/users'
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
            invalidatesTags: [{ type: 'Rating' }, { type: 'Activity' }, { type: 'Notifications' }],
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

        /** Controller: Tags **/
        tagsGetList: builder.query<ApiType.Tags.ListResponse, void>({
            query: () => 'tags'
        }),
        tagsGetSearch: builder.mutation<ApiType.Tags.SearchResponse, Maybe<string>>({
            query: (searchString) => `tags/search?text=${searchString || ''}`
        }),

        /** Controller: User **/
        usersGetItem: builder.query<ApiType.Users.ItemResponse, string>({
            providesTags: ['Users'],
            query: (item) => `users/${item}`
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

        /** Controller: Visited **/
        visitedCheckPlace: builder.query<ApiType.Visited.CheckResponse, ApiType.Visited.CheckRequest>({
            providesTags: (res, err, arg) => [{ id: arg.placeId, type: 'Visited' }],
            query: (params) => `visited${encodeQueryData(params)}`
        }),
        visitedGetUsersList: builder.query<ApiType.Visited.ListResponse, string>({
            providesTags: (result, error, arg) => [{ id: arg, type: 'Visited' }],
            query: (item) => `visited/${item}`
        }),
        visitedPutPlace: builder.mutation<ApiType.Visited.PutResponse, ApiType.Visited.PutRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.place, type: 'Visited' }, { type: 'Notifications' }],
            query: (data) => ({
                body: data,
                method: 'PUT',
                url: 'visited'
            }),
            transformErrorResponse: extractErrorData
        }),
        visitedGetUserPlaces: builder.query<ApiType.Visited.UserPlacesResponse, ApiType.Visited.UserPlacesRequest>({
            providesTags: (res, err, arg) => [{ id: arg.userId, type: 'Visited' }],
            query: (params) =>
                `visited/user/${params.userId}${encodeQueryData({ limit: params.limit, offset: params.offset })}`
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
        'Achievements',
        'AchievementsManage',
        'AchievementsProgress',
        'Activity',
        'Bookmarks',
        'CollectionMembership',
        'Collections',
        'Comments',
        'ExternalPhotos',
        'Notifications',
        'OsmCandidates',
        'Photos',
        'Places',
        'Profile',
        'Rating',
        'SendingMail',
        'UserAchievements',
        'Users',
        'Visited'
    ]
})
