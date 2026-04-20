import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LatLngBounds } from 'leaflet'
import debounce from 'lodash-es/debounce'
import { Button, Input, Message, Select } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslation } from 'next-i18next'

import { API, ApiModel, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { PhotoGallery, PhotoUploader } from '@/components/shared'
import { ChipsSelect, ContentEditor, ImageUploader, ScreenSpinner } from '@/components/ui'
import { categoryImage } from '@/utils/categories'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
    ssr: false
})

interface PlaceFormProps {
    placeId?: string
    loading?: boolean
    values?: ApiType.Places.PostItemRequest
    errors?: ApiType.Places.PostItemRequest
    onSubmit?: (formData?: ApiType.Places.PostItemRequest) => void
    onCancel?: () => void
}

export const PlaceForm: React.FC<PlaceFormProps> = ({ placeId, loading, values, errors, onSubmit, onCancel }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const inputFileRef = useRef<HTMLInputElement>(null)

    const location = useAppSelector((state) => state.application.userLocation)

    const [formData, setFormData] = useState<ApiType.Places.PostItemRequest>()
    const [formErrors, setFormErrors] = useState<ApiType.Places.PostItemRequest>()
    const [uploadingPhotos, setUploadingPhotos] = useState<string[]>()
    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>([])

    const { data: poiListData } = API.usePoiGetListQuery()
    const { data: categoryData } = API.useCategoriesGetListQuery()

    const [searchTags, { data: searchResult, isLoading: searchLoading }] = API.useTagsGetSearchMutation()

    const handleChange = ({ target: { name, value } }: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [name]: value })
    }

    const handleChangeCategory = (category?: string) => {
        setFormData({ ...formData, category })
    }

    const handleSelectTags = (value: string[]) => {
        setFormData({ ...formData, tags: value })
    }

    const handleContentChange = (text?: string) => {
        setFormData({ ...formData, content: text || '' })
    }

    const validateForm = useCallback(() => {
        const errors: ApiType.Places.PostItemRequest = {}

        if (!formData?.title) {
            errors.title = t('error_title-required')
        }

        if (!formData?.category) {
            errors.category = t('error_category-required')
        }

        setFormErrors(errors)

        return !Object.keys(errors).length
    }, [formData])

    const handleSubmit = async () => {
        if (validateForm()) {
            onSubmit?.({
                ...formData,
                photos: !placeId && !!localPhotos?.length ? localPhotos?.map(({ id }) => id) : undefined
            })
        } else {
            await dispatch(
                Notify({
                    id: 'placeFormError',
                    message: t('correct-errors-on-form'),
                    type: 'error'
                })
            )
        }
    }

    const handleKeyPress = async (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            await handleSubmit()
        }
    }

    const handleSearchTags = async (value: string) => {
        if (value.length > 0) {
            await searchTags(value)
        }
    }

    const categoryOptions = useMemo(
        () =>
            categoryData?.items?.map((item) => ({
                image: categoryImage(item.name),
                key: item.name,
                value: item.title
            })),
        [categoryData?.items]
    )

    const selectedCategory = categoryOptions?.find(({ key }) => key === formData?.category)

    const debounceSetMapBounds = useCallback(
        debounce((bounds: LatLngBounds) => {
            const mapCenter = bounds.getCenter()

            if (
                !placeId ||
                (placeId && (formData?.lat || formData?.lat === 0) && (formData.lon || formData.lon === 0))
            ) {
                setFormData({
                    ...formData,
                    lat: mapCenter.lat,
                    lon: mapCenter.lng
                })
            }
        }, 100),
        [formData]
    )

    useEffect(() => {
        if (values) {
            setFormData(values)
        }
    }, [placeId])

    useEffect(() => {
        setFormErrors(errors)
    }, [errors])

    return (
        <section className={styles.component}>
            {loading && <ScreenSpinner />}

            {!!Object.values(formErrors || {})?.length && (
                <Message
                    type={'error'}
                    title={t('correct-errors-on-form')}
                >
                    <ul className={'errorMessageList'}>
                        {Object.values(formErrors || {}).map((item: string) =>
                            item.length ? <li key={`item${item}`}>{item}</li> : ''
                        )}
                    </ul>
                </Message>
            )}

            <div className={styles.formElement}>
                <Input
                    tabIndex={0}
                    required={true}
                    autoFocus={true}
                    name={'title'}
                    label={t('input_geotag-label')}
                    placeholder={t('input_geotag-placeholder')}
                    disabled={loading}
                    value={formData?.title}
                    error={formErrors?.title}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.formElement}>
                <Select<string>
                    required={true}
                    label={t('input_category-label')}
                    placeholder={t('input_category-placeholder')}
                    disabled={loading}
                    error={formErrors?.category}
                    value={categoryOptions?.find(({ key }) => key === formData?.category)?.key}
                    options={categoryOptions}
                    onSelect={(option) => handleChangeCategory(option?.[0]?.key)}
                />
            </div>

            <div className={styles.formElement}>
                <ChipsSelect
                    label={t('input_tags-label')}
                    placeholder={t('input_tags-placeholder')}
                    notFoundCaption={t('nothing-found')}
                    disabled={loading}
                    value={formData?.tags}
                    loading={searchLoading}
                    options={searchResult?.items}
                    onSearch={handleSearchTags}
                    onSelect={handleSelectTags}
                />
            </div>

            <div className={styles.mapContainer}>
                {selectedCategory && (
                    <Image
                        className={styles.categoryImage}
                        src={categoryImage(selectedCategory.key).src}
                        alt={''}
                        width={17}
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
                    zoom={placeId ? 15 : undefined}
                    center={placeId && formData ? [formData.lat!, formData.lon!] : undefined}
                    userLatLon={location}
                    onChangeBounds={debounceSetMapBounds}
                />
            </div>

            <div className={styles.formElement}>
                <label>{t('description')}</label>
                <ContentEditor
                    disabled={loading}
                    value={formData?.content ?? ''}
                    onChange={handleContentChange}
                />
            </div>

            {!placeId && (
                <div className={styles.formElement}>
                    {localPhotos?.length ? (
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
                </div>
            )}

            <div className={styles.actions}>
                <Button
                    size={'medium'}
                    mode={'primary'}
                    label={t('save')}
                    disabled={loading}
                    onClick={handleSubmit}
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
                    onSelectFiles={setUploadingPhotos}
                    onUploadPhoto={(photo) => {
                        setLocalPhotos([photo, ...localPhotos])
                    }}
                />
            )}
        </section>
    )
}
