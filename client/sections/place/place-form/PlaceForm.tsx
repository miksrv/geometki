import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { LatLngBounds } from 'leaflet'
import debounce from 'lodash-es/debounce'
import { Button, Input, Message, Select, SelectOptionType } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { PhotoGallery, PhotoUploader } from '@/components/shared'
import type { PhotoUploaderHandle } from '@/components/shared/photo-uploader'
import { ContentEditor, FileDropZone, ImageUploader, ScreenSpinner } from '@/components/ui'
import { categoryImage, getCategoryOptions } from '@/utils/categories'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
    ssr: false
})

type PlaceFormValues = Required<Pick<ApiType.Places.PostItemRequest, 'title' | 'category' | 'content' | 'tags'>> &
    Pick<ApiType.Places.PostItemRequest, 'lat' | 'lon'>

type PlaceFormErrors = Partial<Record<keyof ApiType.Places.PostItemRequest, string>>

const FIELDS: Array<keyof PlaceFormValues> = ['title', 'category', 'tags', 'lat', 'lon', 'content']

// Map center differences below this are float noise of the bounds → center round trip, not a move
const COORDS_EPSILON = 0.000001

const toFormValues = (values?: ApiType.Places.PostItemRequest): PlaceFormValues => ({
    category: values?.category ?? '',
    content: values?.content ?? '',
    lat: values?.lat,
    lon: values?.lon,
    tags: values?.tags ?? [],
    title: values?.title ?? ''
})

interface PlaceFormProps {
    placeId?: string
    loading?: boolean
    values?: ApiType.Places.PostItemRequest
    /** Server-side validation errors, shown on their fields */
    errors?: PlaceFormErrors
    onSubmit?: (formData?: ApiType.Places.PostItemRequest) => void
    onCancel?: () => void
    /** Reports whether the form holds changes that would be lost on leaving */
    onDirtyChange?: (isDirty: boolean) => void
}

export const PlaceForm: React.FC<PlaceFormProps> = ({
    placeId,
    loading,
    values,
    errors,
    onSubmit,
    onCancel,
    onDirtyChange
}) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const inputFileRef = useRef<HTMLInputElement>(null)
    const uploaderRef = useRef<PhotoUploaderHandle>(null)

    const location = useAppSelector((state) => state.application.userLocation)

    const {
        control,
        formState: { errors: formErrors, isDirty },
        handleSubmit,
        register,
        reset,
        resetField,
        setError,
        setValue,
        watch
    } = useForm<PlaceFormValues>({ defaultValues: toFormValues(values) })

    const [uploadingPhotos, setUploadingPhotos] = useState<string[]>()
    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>([])
    const [tagSearch, setTagSearch] = useState('')
    // Edit page, or a new place prefilled from an OSM candidate: the map starts at the given point
    const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(() => {
        if (values?.lat != null && values?.lon != null) {
            return [values.lat, values.lon]
        }
        return undefined
    })

    const category = watch('category')
    const tags = watch('tags')

    const { data: poiListData } = API.usePoiGetListQuery()

    const [searchTags, { data: searchResult, isLoading: searchLoading }] = API.useTagsGetSearchMutation()

    const onValid = (data: PlaceFormValues) => {
        onSubmit?.({
            ...data,
            photos: !placeId && !!localPhotos?.length ? localPhotos?.map(({ id }) => id) : undefined
        })
    }

    const onInvalid = () => {
        void dispatch(
            Notify({
                id: 'placeFormError',
                message: t('correct-errors-on-form'),
                type: 'error'
            })
        )
    }

    const submit = handleSubmit(onValid, onInvalid)

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void submit()
        }
    }

    const debouncedSearchTags = useCallback(
        debounce(async (value: string) => {
            if (value.length > 0) {
                await searchTags(value)
            }
        }, 500),
        []
    )

    const handleSearchTags = (value?: string) => {
        const text = value ?? ''
        setTagSearch(text)
        void debouncedSearchTags(text)
    }

    const categoryOptions = useMemo(() => getCategoryOptions(t), [t])

    const selectedCategory = categoryOptions?.find(({ key }) => key === category)

    const tagOptions = useMemo<Array<SelectOptionType<string>>>(() => {
        const selected = (tags ?? []).map((tag) => ({ key: tag, value: tag }))
        const results = (searchResult?.items ?? []).map((tag) => ({ key: tag, value: tag }))
        const merged = [...selected]
        for (const opt of results) {
            if (!merged.find((m) => m.key === opt.key)) {
                merged.push(opt)
            }
        }
        return merged
    }, [tags, searchResult?.items])

    const tagsWithCustom = useMemo<Array<SelectOptionType<string>>>(() => {
        if (!tagSearch || tagOptions.find((opt) => opt.key.toLowerCase() === tagSearch.toLowerCase())) {
            return tagOptions
        }
        return [{ key: tagSearch, value: tagSearch }, ...tagOptions]
    }, [tagOptions, tagSearch])

    // The map center is the place's position. Only a real move on the edit page counts as a
    // change: on the create page the map just starts wherever it was last left, so its center
    // becomes the baseline instead.
    const debounceSetMapBounds = useCallback(
        debounce((bounds: LatLngBounds) => {
            const { lat, lng } = bounds.getCenter()

            if (!placeId) {
                resetField('lat', { defaultValue: lat })
                resetField('lon', { defaultValue: lng })
                return
            }

            const initial = toFormValues(values)
            const moved =
                Math.abs(lat - (initial.lat ?? 0)) > COORDS_EPSILON ||
                Math.abs(lng - (initial.lon ?? 0)) > COORDS_EPSILON

            setValue('lat', moved ? lat : initial.lat, { shouldDirty: true })
            setValue('lon', moved ? lng : initial.lon, { shouldDirty: true })
        }, 100),
        [placeId, values]
    )

    // The coordinates have no input of their own (the map sets them), but they must be registered:
    // `resetField` ignores unregistered fields, and `handleSubmit` only clears errors of registered ones
    useEffect(() => {
        register('lat')
        register('lon')
    }, [register])

    useEffect(() => {
        if (values) {
            reset(toFormValues(values))
            if (values.lat != null && values.lon != null) {
                setMapCenter([values.lat, values.lon])
            }
        }
    }, [placeId])

    useEffect(() => {
        Object.entries(errors ?? {}).forEach(([field, message]) => {
            if (message && FIELDS.includes(field as keyof PlaceFormValues)) {
                setError(field as keyof PlaceFormValues, { message, type: 'server' })
            }
        })
    }, [errors])

    // Photos uploaded to a new place are temporary and lost on leaving, so they count too
    useEffect(() => {
        onDirtyChange?.(isDirty || localPhotos.length > 0)
    }, [isDirty, localPhotos.length])

    const errorMessages = Object.values(formErrors)
        .map((error) => error?.message)
        .filter((message): message is string => !!message)

    return (
        <section className={styles.component}>
            {loading && <ScreenSpinner />}

            {!!errorMessages.length && (
                <Message
                    type={'error'}
                    title={t('correct-errors-on-form')}
                >
                    <ul className={'errorMessageList'}>
                        {errorMessages.map((item) => (
                            <li key={`item${item}`}>{item}</li>
                        ))}
                    </ul>
                </Message>
            )}

            <div className={styles.formElement}>
                <Controller
                    name={'title'}
                    control={control}
                    rules={{ validate: (value) => !!value.trim() || t('error_title-required') }}
                    render={({ field, fieldState }) => (
                        <Input
                            tabIndex={0}
                            required={true}
                            autoFocus={true}
                            name={field.name}
                            label={t('input_geotag-label')}
                            placeholder={t('input_geotag-placeholder')}
                            disabled={loading}
                            value={field.value}
                            error={fieldState.error?.message}
                            onKeyDown={handleKeyPress}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                        />
                    )}
                />
            </div>

            <div className={styles.formElement}>
                <Controller
                    name={'category'}
                    control={control}
                    rules={{ required: t('error_category-required') }}
                    render={({ field, fieldState }) => (
                        <Select<string>
                            required={true}
                            label={t('input_category-label')}
                            placeholder={t('input_category-placeholder')}
                            disabled={loading}
                            error={fieldState.error?.message}
                            value={selectedCategory?.key}
                            options={categoryOptions}
                            onSelect={(option) => field.onChange(option?.[0]?.key ?? '')}
                        />
                    )}
                />
            </div>

            <div className={styles.formElement}>
                <Controller
                    name={'tags'}
                    control={control}
                    render={({ field }) => (
                        <Select<string>
                            multiple
                            searchable
                            closeOnSelect={false}
                            label={t('input_tags-label')}
                            placeholder={t('input_tags-placeholder')}
                            notFoundCaption={t('nothing-found')}
                            disabled={loading}
                            value={field.value}
                            loading={searchLoading}
                            options={tagsWithCustom}
                            onSearch={handleSearchTags}
                            onSelect={(selected) => field.onChange(selected?.map((opt) => opt.key) ?? [])}
                        />
                    )}
                />
            </div>

            <div className={styles.mapContainer}>
                {selectedCategory && (
                    <Image
                        className={styles.categoryImage}
                        src={categoryImage(selectedCategory.key).src}
                        alt={''}
                        width={20}
                        height={20}
                    />
                )}
                <InteractiveMap
                    // enableSearch={true}
                    enableFullScreen={true}
                    enableCoordsControl={true}
                    enableLayersSwitcher={true}
                    enableCenterPopup={true}
                    hideAdditionalLayers={true}
                    scrollWheelZoom={!placeId}
                    places={poiListData?.items}
                    storeMapPosition={!placeId}
                    zoom={mapCenter ? 15 : undefined}
                    center={mapCenter}
                    userLatLon={location}
                    onChangeBounds={debounceSetMapBounds}
                />
            </div>

            <div className={styles.formElement}>
                <label>{t('description')}</label>
                <Controller
                    name={'content'}
                    control={control}
                    render={({ field }) => (
                        <ContentEditor
                            disabled={loading}
                            value={field.value}
                            onChange={(text) => field.onChange(text || '')}
                        />
                    )}
                />
            </div>

            {!placeId && (
                <FileDropZone
                    className={styles.formElement}
                    label={t('photo-drop-label', { defaultValue: 'Перетащите фотографии сюда, чтобы загрузить' })}
                    hint={t('photo-drop-hint', { defaultValue: 'JPG, PNG, GIF или WEBP, до 10 МБ' })}
                    disabled={loading}
                    onDrop={(files) => uploaderRef.current?.upload(files)}
                >
                    {localPhotos.length || uploadingPhotos?.length ? (
                        <div className={styles.formElement}>
                            <PhotoGallery
                                photos={localPhotos}
                                className={styles.gallery}
                                uploadingPhotos={uploadingPhotos}
                                onPhotoDelete={setLocalPhotos}
                                onPhotoUploadClick={() => inputFileRef?.current?.click()}
                            />
                        </div>
                    ) : (
                        <ImageUploader
                            disabled={loading}
                            onClick={() => inputFileRef?.current?.click()}
                        />
                    )}
                </FileDropZone>
            )}

            <div className={styles.actions}>
                <Button
                    size={'medium'}
                    mode={'primary'}
                    label={t('save')}
                    // Photos still uploading would not be attached to the new place
                    disabled={loading || !!uploadingPhotos?.length}
                    onClick={() => void submit()}
                />

                <Button
                    size={'medium'}
                    mode={'secondary'}
                    label={t('cancel')}
                    disabled={loading}
                    onClick={onCancel}
                />
            </div>

            {!placeId && (
                <PhotoUploader
                    placeId={'temporary'}
                    fileInputRef={inputFileRef}
                    uploaderRef={uploaderRef}
                    onSelectFiles={setUploadingPhotos}
                    onUploadPhoto={(photo) => setLocalPhotos((prev) => [photo, ...prev])}
                />
            )}
        </section>
    )
}
