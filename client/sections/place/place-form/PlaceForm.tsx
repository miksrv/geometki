import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { LatLngBounds } from 'leaflet'
import debounce from 'lodash-es/debounce'
import { cn, Input, Message, Select } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { PhotoGallery, PhotoUploader } from '@/components/shared'
import type { PhotoUploaderHandle } from '@/components/shared/photo-uploader'
import { ContentEditor, FileDropZone, FormActions, FormSection, FormSections, UploadZone } from '@/components/ui'
import type { FormSectionsItem } from '@/components/ui/form-sections'
import { categoryImage, getCategoryOptions } from '@/utils/categories'
import { scrollToFirstError } from '@/utils/scrollToFirstError'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
    ssr: false
})

type PlaceFormValues = Required<Pick<ApiType.Places.PostItemRequest, 'title' | 'category' | 'content'>> &
    Pick<ApiType.Places.PostItemRequest, 'lat' | 'lon'>

// The fields' errors and `error`, the API's message that belongs to no field
type PlaceFormErrors = Partial<Record<keyof ApiType.Places.PostItemRequest | 'error', string>>

const FIELDS: Array<keyof PlaceFormValues> = ['title', 'category', 'lat', 'lon', 'content']

// The API's limits (server/app/Libraries/PlaceInput.php)
export const PLACE_TITLE_MIN = 8
export const PLACE_TITLE_MAX = 200
export const PLACE_CONTENT_MAX = 20000

// Map center differences below this are float noise of the bounds → center round trip, not a move
const COORDS_EPSILON = 0.000001

const toFormValues = (values?: ApiType.Places.PostItemRequest): PlaceFormValues => ({
    category: values?.category ?? '',
    content: values?.content ?? '',
    lat: values?.lat,
    lon: values?.lon,
    title: values?.title ?? ''
})

interface PlaceFormProps {
    placeId?: string
    loading?: boolean
    /** Fields and saving are off, without the screen spinner of `loading`: e.g. while the values load */
    disabled?: boolean
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
    disabled,
    values,
    errors,
    onSubmit,
    onCancel,
    onDirtyChange
}) => {
    const { t, i18n } = useTranslation()

    const inputFileRef = useRef<HTMLInputElement>(null)
    const uploaderRef = useRef<PhotoUploaderHandle>(null)

    const {
        clearErrors,
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
    // Edit page, or a new place prefilled from an OSM candidate: the map starts at the given point
    const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(() => {
        if (values?.lat != null && values?.lon != null) {
            return [values.lat, values.lon]
        }
        return undefined
    })

    const category = watch('category')

    const { data: poiListData } = API.usePoiGetListQuery()

    const onValid = (data: PlaceFormValues) => {
        // Enter in the title submits too: photos still uploading would not be attached
        if (uploadingPhotos?.length) {
            return
        }

        // The map reports its center a moment after it is shown: no place without it. The
        // coordinates have no input, so react-hook-form's own checks skip them
        if (!Number.isFinite(data.lat) || !Number.isFinite(data.lon)) {
            setError('lat', {
                message: t(data.lat == null ? 'place-form-location-required' : 'place-form-location-invalid'),
                type: 'validate'
            })
            scrollToFirstError({ lat: { type: 'validate' } })
            return
        }

        onSubmit?.({
            ...data,
            title: data.title.trim(),
            photos: !placeId && !!localPhotos?.length ? localPhotos?.map(({ id }) => id) : undefined
        })
    }

    const submit = handleSubmit(onValid, (invalid) => scrollToFirstError(invalid))

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void submit()
        }
    }

    const categoryOptions = useMemo(() => getCategoryOptions(t), [t])

    const selectedCategory = categoryOptions?.find(({ key }) => key === category)

    // The map center is the place's position. Only a real move on the edit page counts as a
    // change: on the create page the map just starts wherever it was last left, so its center
    // becomes the baseline instead.
    const debounceSetMapBounds = useCallback(
        debounce((bounds: LatLngBounds) => {
            // `wrap()`: a map panned round the globe has its longitude beyond ±180
            const { lat, lng } = bounds.getCenter().wrap()

            // The place is marked now: an error on the coordinates is gone
            clearErrors(['lat', 'lon'])

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

    // The API's errors go on their fields, and the first of them is brought into view
    useEffect(() => {
        const serverErrors = Object.entries(errors ?? {}).filter(
            (entry): entry is [keyof PlaceFormValues, string] =>
                !!entry[1] && FIELDS.includes(entry[0] as keyof PlaceFormValues)
        )

        serverErrors.forEach(([field, message]) => setError(field, { message, type: 'server' }))

        if (serverErrors.length) {
            scrollToFirstError(Object.fromEntries(serverErrors.map(([field]) => [field, { type: 'server' }])))
        }
    }, [errors])

    // A general error is above the cards: it is brought into view as a field's error would be
    const generalErrorRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (Object.keys(errors ?? {}).some((field) => !FIELDS.includes(field as keyof PlaceFormValues))) {
            generalErrorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
        }
    }, [errors])

    // Photos uploaded to a new place are temporary and lost on leaving, so they count too
    const hasChanges = isDirty || localPhotos.length > 0

    useEffect(() => {
        onDirtyChange?.(hasChanges)
    }, [hasChanges])

    // The API's errors that belong to no field: `error` (the address of the point could not be
    // found, the save failed), `locale`, `photos`, `candidate`. Without this they were lost and
    // the form just stopped spinning
    const generalErrors = Array.from(
        new Set(
            Object.entries(errors ?? {})
                .filter(([field, message]) => !!message && !FIELDS.includes(field as keyof PlaceFormValues))
                .map(([, message]) => message as string)
        )
    )

    // The server may name both coordinates with one message: each is listed once
    const errorMessages = Array.from(
        new Set(
            Object.values(formErrors)
                .map((error) => error?.message)
                .filter((message): message is string => !!message)
        )
    )

    // A title or a description saved before the limits stays as it is until it is changed:
    // an edit of the category must not stumble over an old short title. A new place has nothing
    // saved: a prefilled one (an OSM candidate's name) is checked as typed
    const initial = toFormValues(placeId ? values : undefined)

    const validateTitle = (value: string) => {
        const title = value.trim()

        if (!title) {
            return t('error_title-required')
        }

        if (title === initial.title.trim()) {
            return true
        }

        if (title.length < PLACE_TITLE_MIN) {
            return t('error_title-too-short', { min: PLACE_TITLE_MIN })
        }

        return title.length <= PLACE_TITLE_MAX || t('error_title-too-long', { max: PLACE_TITLE_MAX })
    }

    const validateContent = (value: string) =>
        value === initial.content ||
        value.length <= PLACE_CONTENT_MAX ||
        t('error_content-too-long', { max: PLACE_CONTENT_MAX.toLocaleString(i18n.language) })

    const locked = loading || disabled
    const uploading = !!uploadingPhotos?.length
    const locationError = formErrors.lat?.message ?? formErrors.lon?.message

    // The parts: the anchors of the side menu (desktop) and the ids of the cards
    const sections: FormSectionsItem[] = [
        { icon: 'Tag', key: 'place-main', title: t('place-form-section-main') },
        { icon: 'PinDrop', key: 'place-location', title: t('place-form-section-location') },
        { icon: 'Pencil', key: 'place-description', title: t('description') },
        ...(placeId ? [] : [{ icon: 'Photo', key: 'place-photos', title: t('photos') } as FormSectionsItem])
    ]

    return (
        <FormSections
            sections={sections}
            label={t('place-form-sections')}
        >
            {!!generalErrors.length && (
                <div ref={generalErrorRef}>
                    <Message type={'error'}>{generalErrors.join(' ')}</Message>
                </div>
            )}

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

            <FormSection
                id={'place-main'}
                title={t('place-form-section-main')}
            >
                <div className={styles.fields}>
                    <Controller
                        name={'title'}
                        control={control}
                        rules={{ validate: validateTitle }}
                        render={({ field, fieldState }) => (
                            <Input
                                required={true}
                                // A new empty place starts at its title; an edit or a prefilled
                                // form does not pop up the phone keyboard
                                autoFocus={!placeId && !values?.title}
                                size={'medium'}
                                name={field.name}
                                maxLength={PLACE_TITLE_MAX}
                                label={t('input_geotag-label')}
                                placeholder={t('input_geotag-placeholder')}
                                disabled={locked}
                                value={field.value}
                                error={fieldState.error?.message}
                                onKeyDown={handleKeyPress}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                            />
                        )}
                    />

                    <Controller
                        name={'category'}
                        control={control}
                        rules={{ required: t('error_category-required') }}
                        render={({ field, fieldState }) => (
                            <Select<string>
                                data-field={'category'}
                                required={true}
                                size={'medium'}
                                searchable={true}
                                label={t('input_category-label')}
                                placeholder={t('input_category-placeholder')}
                                notFoundCaption={t('nothing-found')}
                                disabled={locked}
                                error={fieldState.error?.message}
                                value={selectedCategory?.key}
                                options={categoryOptions}
                                onSelect={(option) => field.onChange(option?.[0]?.key ?? '')}
                            />
                        )}
                    />
                </div>
            </FormSection>

            <FormSection
                id={'place-location'}
                title={t('place-form-section-location')}
                description={t('place-form-location-hint')}
            >
                <div
                    data-field={'lat lon'}
                    className={cn(styles.mapContainer, locationError && styles.invalid)}
                >
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
                        enableUserLocation={true}
                        onChangeBounds={debounceSetMapBounds}
                    />
                </div>

                {locationError && <p className={styles.fieldError}>{locationError}</p>}
            </FormSection>

            <FormSection
                id={'place-description'}
                title={t('description')}
                description={t('place-form-description-hint')}
            >
                <div data-field={'content'}>
                    <Controller
                        name={'content'}
                        control={control}
                        rules={{ validate: validateContent }}
                        render={({ field }) => (
                            <ContentEditor
                                disabled={locked}
                                value={field.value}
                                onChange={(text) => field.onChange(text || '')}
                            />
                        )}
                    />
                </div>

                {formErrors.content?.message && <p className={styles.fieldError}>{formErrors.content.message}</p>}
            </FormSection>

            {!placeId && (
                <FormSection
                    id={'place-photos'}
                    title={t('photos')}
                    description={t('place-form-photos-hint')}
                >
                    <FileDropZone
                        label={t('photo-drop-label', { defaultValue: 'Перетащите фотографии сюда, чтобы загрузить' })}
                        hint={t('photo-drop-hint')}
                        disabled={locked}
                        onDrop={(files) => uploaderRef.current?.upload(files)}
                    >
                        {localPhotos.length || uploading ? (
                            <PhotoGallery
                                photos={localPhotos}
                                className={styles.gallery}
                                uploadingPhotos={uploadingPhotos}
                                onPhotoDelete={setLocalPhotos}
                                onPhotoUploadClick={() => inputFileRef?.current?.click()}
                            />
                        ) : (
                            <UploadZone
                                title={t('place-form-photos-empty')}
                                hint={t('photo-upload-hint')}
                                disabled={locked}
                                onClick={() => inputFileRef?.current?.click()}
                            />
                        )}
                    </FileDropZone>

                    <PhotoUploader
                        placeId={'temporary'}
                        fileInputRef={inputFileRef}
                        uploaderRef={uploaderRef}
                        onSelectFiles={setUploadingPhotos}
                        onUploadPhoto={(photo) => setLocalPhotos((prev) => [photo, ...prev])}
                    />
                </FormSection>
            )}

            <FormActions
                dirty={hasChanges}
                loading={loading}
                // A new place is saved as it is (a prefilled one too), the checks tell what is
                // missing; an edit waits for a change. Photos still uploading would not be attached
                saveDisabled={disabled || uploading || (!!placeId && !isDirty)}
                saveLabel={placeId ? undefined : t('place-form-submit-create')}
                onSave={() => void submit()}
                onCancel={onCancel}
            />
        </FormSections>
    )
}
