import { HYDRATE } from 'next-redux-wrapper'
import type { Action, PayloadAction } from '@reduxjs/toolkit'
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import { ApiType } from '@/api'
import { RootState } from '@/api/store'
import { encodeQueryData } from '@/functions/helpers'

type Maybe<T> = T | void

type APIErrorType = {
    messages: {
        error?: string
    }
}

const isHydrateAction = (action: Action): action is PayloadAction<RootState> => action.type === HYDRATE

export const API = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8080/',
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
            providesTags: (result, error, arg) => [{ id: arg?.author ?? arg?.place, type: 'Activity' }],
            query: (params) => `activity${encodeQueryData(params)}`,
            serializeQueryArgs: ({ endpointName, queryArgs }) => queryArgs?.author ?? queryArgs?.place ?? endpointName
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
            transformErrorResponse: (response) => (response.data as APIErrorType).messages.error
        }),
        authPostLogin: builder.mutation<ApiType.Auth.LoginResponse, ApiType.Auth.PostLoginNativeRequest>({
            query: (credentials) => ({
                body: credentials,
                method: 'POST',
                url: 'auth/login'
            }),
            transformErrorResponse: (response) => response.data
        }),
        authPostRegistration: builder.mutation<ApiType.Auth.LoginResponse, ApiType.Auth.PostRegistrationRequest>({
            query: (credentials) => ({
                body: credentials,
                method: 'POST',
                url: 'auth/registration'
            }),
            transformErrorResponse: (response) => response.data
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
            transformErrorResponse: (response) => response.data
        }),

        /** Controller: Categories v*/
        categoriesGetList: builder.query<ApiType.Categories.Response, Maybe<ApiType.Categories.Request>>({
            query: (params) => `categories${encodeQueryData(params)}`
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
            transformErrorResponse: (response) => response.data
        }),

        /** Controller: Levels **/
        levelsGetList: builder.query<ApiType.Levels.Response, void>({
            query: () => 'levels'
        }),

        /** Controller: Mail **/
        mailGetUnsubscribe: builder.query<string, Maybe<string>>({
            query: (mailId) => `mail/unsubscribe?mail=${mailId || ''}`,
            transformErrorResponse: (response) => (response.data as APIErrorType).messages.error
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
                if ((arg?.offset as number) === 0 && newItems.count === 0 && currentCache.items) {
                    currentCache.items.length = 0
                } else {
                    currentCache.items?.push(...(newItems.items ?? []))
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

        /** Controller: Photos **/
        photoDeleteItem: builder.mutation<ApiType.Photos.DeleteResponse, ApiType.Photos.DeleteRequest>({
            query: (params) => ({
                method: 'DELETE',
                url: `photos/${params?.temporary ? 'temporary/' : ''}${params?.id}`
            }),
            transformErrorResponse: (response) => (response.data as APIErrorType).messages.error
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
            transformErrorResponse: (response) => (response.data as APIErrorType).messages.error
        }),
        photoRotateItem: builder.mutation<ApiType.Photos.RotateResponse, ApiType.Photos.RotateRequest>({
            query: (params) => ({
                method: 'PATCH',
                url: `photos/rotate/${params?.temporary ? 'temporary/' : ''}${params?.id}`
            }),
            transformErrorResponse: (response) => (response.data as APIErrorType).messages.error
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
            transformErrorResponse: (response) => (response.data as APIErrorType).messages.error
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
            transformErrorResponse: (response) => response.data
        }),
        placesPostItem: builder.mutation<ApiType.Places.PostItemResponse, Omit<ApiType.Places.PostItemRequest, 'id'>>({
            invalidatesTags: [{ type: 'Places' }, { type: 'Activity' }, { type: 'Notifications' }],
            query: (data) => ({
                body: data,
                method: 'POST',
                url: 'places'
            }),
            transformErrorResponse: (response) => response.data
        }),

        /** Controller: POI **/
        poiGetItem: builder.mutation<ApiType.POI.PoiItemResponse, string>({
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

        /** Controller: Rating **/
        ratingGetList: builder.query<ApiType.Rating.ListResponse, string>({
            providesTags: ['Rating'],
            query: (item) => `rating/${item}`
        }),
        ratingGetHistory: builder.query<ApiType.Rating.HistoryResponse, ApiType.Rating.HistoryRequest>({
            providesTags: ['Rating'],
            query: (params) => `rating/history${encodeQueryData(params)}`
        }),
        ratingPutScore: builder.mutation<ApiType.Rating.PutResponse, ApiType.Rating.PutRequest>({
            invalidatesTags: [{ type: 'Rating' }, { type: 'Activity' }, { type: 'Notifications' }],
            query: (data) => ({
                body: data,
                method: 'PUT',
                url: 'rating'
            }),
            transformErrorResponse: (response) => response.data
        }),

        /** Controller: Sitemap **/
        sitemapGetList: builder.query<ApiType.SiteMap.Response, void>({
            query: () => 'sitemap'
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
            transformErrorResponse: (response) => response.data
        }),
        usersPatchProfile: builder.mutation<void, ApiType.Users.PatchRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.id, type: 'Users' }, { type: 'Users' }],
            query: (data) => ({
                body: data,
                method: 'PATCH',
                url: `users/${data.id}`
            }),
            transformErrorResponse: (response) => response.data
        }),
        usersPostUploadAvatar: builder.mutation<ApiType.Users.UploadAvatarResponse, { formData: FormData }>({
            query: (data) => ({
                body: data.formData,
                method: 'POST',
                url: 'users/avatar'
            }),
            transformErrorResponse: (response) => response.data
        }),

        /** Controller: Visited **/
        visitedGetUsersList: builder.query<ApiType.Visited.ListResponse, string>({
            providesTags: (result, error, arg) => [{ id: arg, type: 'Visited' }],
            query: (item) => `visited/${item}`
        }),
        visitedPutPlace: builder.mutation<void, ApiType.Visited.PutRequest>({
            invalidatesTags: (res, err, arg) => [{ id: arg.place, type: 'Visited' }, { type: 'Notifications' }],
            query: (data) => ({
                body: data,
                method: 'PUT',
                url: 'visited'
            }),
            transformErrorResponse: (response) => response.data
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
        'Activity',
        'Bookmarks',
        'Places',
        'Photos',
        'Rating',
        'Visited',
        'Users',
        'Profile',
        'Comments',
        'Notifications'
    ]
})
