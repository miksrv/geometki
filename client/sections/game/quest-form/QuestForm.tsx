import React, { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, cn, Icon, Input, Message, Skeleton, TextArea } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { collectionPickerStyles, ConfirmationDialog, ImageSlot, QUEST_MODE_ICONS } from '@/components/shared'
import { FormActions, FormSection, FormSections, OptionList, Switch } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { QuestMedal } from '@/sections/game/quest-medal'
import { addressToString } from '@/utils/address'
import { getErrorMessage, isApiValidationErrors } from '@/utils/api'
import { getCategoryTitle } from '@/utils/categories'
import { formatLength, questHref, QUESTS_HREF } from '@/utils/game'
import { haversineDistanceKm } from '@/utils/geo'
import { buildPlaceUrl } from '@/utils/helpers'
import { scrollToFirstError } from '@/utils/scrollToFirstError'

import styles from './styles.module.sass'

const TITLE_MAX = 150
const DESCRIPTION_MAX = 5000
const HINT_MAX = 1000
const POINTS_MIN = 2
const POINTS_MAX = 30

const SEARCH_MIN_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 300

const MODES: ApiType.Game.QuestMode[] = ['open', 'steps', 'riddles', 'photos']

/** The texts are edited in the site's language only (as a place's): the other one is kept */
type Lang = 'Ru' | 'En'

interface FormValues {
    title: string
    description: string
    mode: ApiType.Game.QuestMode
    published: boolean
}

/** A point of the quest being edited: the place and what the walker is told about it, in the site's language */
interface PointDraft {
    place: ApiModel.PlaceListItem
    hint: string
}

interface QuestFormProps {
    /** The quest to edit (`GET /game/quests/:id?edit=1`); a new one without it */
    quest?: ApiType.Game.QuestResponse
}

const toPoints = (lang: Lang, quest?: ApiType.Game.QuestResponse): PointDraft[] =>
    (quest?.items ?? [])
        .filter((point): point is ApiType.Game.QuestPoint & { place: ApiModel.PlaceListItem } => !!point.place)
        .map((point) => ({ hint: point[`hint${lang}`] ?? '', place: point.place }))

const pointsKey = (points: PointDraft[]): string =>
    JSON.stringify(points.map(({ place, hint }) => [place.id, hint.trim()]))

/**
 * The editor of a quest (administrators): a page form in parts — the texts in both languages,
 * the mode, the points. The points are the site's places in the order of the walk, found by
 * their title; each takes a hint — a tip for an open or a step quest, the riddle itself for a
 * riddle quest, none for a photo quest (its riddle is the place's first photo: a place without one is
 * marked "Нет фото" and cannot be added; the server says no too). The length is the sum of the straight lines between the points, shown as the
 * list changes. A draft is seen by administrators only.
 */
export const QuestForm: React.FC<QuestFormProps> = ({ quest }) => {
    const { t, i18n } = useTranslation()
    const lang: Lang = i18n.language.startsWith('en') ? 'En' : 'Ru'
    // The title in the other language: with it the title here may stay empty
    const otherTitle = quest?.[`title${lang === 'Ru' ? 'En' : 'Ru'}`]
    const dispatch = useAppDispatch()
    const router = useRouter()

    const [createQuest, { isLoading: creating }] = API.useQuestsPostMutation()
    const [updateQuest, { isLoading: updating }] = API.useQuestsPatchMutation()
    const [deleteQuest, { isLoading: deleting }] = API.useQuestsDeleteMutation()
    const [uploadMedal] = API.useQuestsPostMedalMutation()
    const [removeMedal] = API.useQuestsDeleteMedalMutation()

    const {
        control,
        handleSubmit,
        setError,
        watch,
        formState: { isDirty }
    } = useForm<FormValues>({
        defaultValues: {
            description: quest?.[`description${lang}`] ?? '',
            mode: quest?.mode ?? 'steps',
            published: quest?.status === 'published',
            title: quest?.[`title${lang}`] ?? ''
        }
    })

    const mode = watch('mode')

    const initialPoints = useMemo(() => toPoints(lang, quest), [lang, quest])
    const [points, setPoints] = useState<PointDraft[]>(initialPoints)
    const [pointsError, setPointsError] = useState<string>()
    const [serverError, setServerError] = useState<string>()
    const [deleteOpen, setDeleteOpen] = useState<boolean>(false)

    const pointsChanged = pointsKey(points) !== pointsKey(initialPoints)
    const dirty = isDirty || pointsChanged
    const saving = creating || updating

    const { allowNavigation, confirmDiscard, dialogProps } = useUnsavedChangesGuard(dirty)

    // --- The search of places to add ---------------------------------------------------------
    const [search, setSearch] = useState<string>('')
    const [query, setQuery] = useState<string>('')

    useEffect(() => {
        const trimmed = search.trim()

        if (trimmed.length < SEARCH_MIN_LENGTH) {
            setQuery(trimmed)
            return
        }

        const timer = setTimeout(() => setQuery(trimmed), SEARCH_DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [search])

    const canSearch = query.length >= SEARCH_MIN_LENGTH
    const { data: found, isFetching: searching } = API.usePlacesGetListQuery(
        { limit: 8, search: query },
        { skip: !canSearch }
    )

    const usedIds = useMemo(() => new Set(points.map(({ place }) => place.id)), [points])
    const results = found?.items?.filter((place) => !usedIds.has(place.id))

    const length = useMemo(
        () =>
            points.reduce(
                (sum, { place }, index) =>
                    index ? sum + haversineDistanceKm(points[index - 1].place, place) * 1000 : sum,
                0
            ),
        [points]
    )

    const addPoint = (place: ApiModel.PlaceListItem) => {
        setPoints((list) => [...list, { hint: '', place }])
        setPointsError(undefined)
    }

    const movePoint = (index: number, shift: -1 | 1) =>
        setPoints((list) => {
            const next = [...list]
            const target = index + shift

            if (target < 0 || target >= next.length) {
                return list
            }

            ;[next[index], next[target]] = [next[target], next[index]]

            return next
        })

    const changeHint = (index: number, value: string) =>
        setPoints((list) => list.map((point, i) => (i === index ? { ...point, hint: value } : point)))

    const onSubmit = async (values: FormValues) => {
        setServerError(undefined)

        if (points.length < POINTS_MIN || points.length > POINTS_MAX) {
            setPointsError(t('game-quest-form-points-error', { max: POINTS_MAX, min: POINTS_MIN }))
            document.getElementById('points')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }

        // The site's language only: the server keeps the other one (a bot may send both)
        const body: ApiType.Game.QuestInput = {
            [`description${lang}`]: values.description.trim(),
            mode: values.mode,
            points: points.map(({ place, hint }) => ({ [`hint${lang}`]: hint.trim() || null, place: place.id })),
            status: values.published ? 'published' : 'draft',
            [`title${lang}`]: values.title.trim()
        }

        try {
            const saved = quest
                ? await updateQuest({ ...body, id: quest.id }).unwrap()
                : await createQuest(body).unwrap()

            void dispatch(Notify({ id: 'questSaved', message: t('game-quest-form-saved'), title: '', type: 'success' }))

            allowNavigation()
            await router.push(questHref(saved.id, saved.slug))
        } catch (error) {
            if (isApiValidationErrors<{ titleRu: string; titleEn: string; points: string; error: string }>(error)) {
                const { messages } = error
                const titleError = messages[`title${lang}`] ?? messages.titleRu ?? messages.titleEn

                if (titleError) {
                    setError('title', { message: titleError })
                }

                setPointsError(messages.points)
                setServerError(messages.error)

                return
            }

            setServerError(getErrorMessage(error) ?? t('game-quest-form-error'))
        }
    }

    const handleDelete = async () => {
        if (!quest) {
            return
        }

        try {
            await deleteQuest(quest.id).unwrap()

            setDeleteOpen(false)
            allowNavigation()
            await router.push(QUESTS_HREF)
        } catch (error) {
            setDeleteOpen(false)
            setServerError(getErrorMessage(error) ?? t('game-quest-form-error'))
        }
    }

    const sections = [
        { icon: 'Pencil' as const, key: 'texts', title: t('game-quest-form-texts') },
        { icon: 'Compass' as const, key: 'mode', title: t('game-quest-form-mode') },
        { icon: 'Point' as const, key: 'points', title: t('game-quest-form-points') },
        // The medal is saved at once, apart from the form: a saved quest only
        ...(quest ? [{ icon: 'Award' as const, key: 'medal', title: t('game-quest-form-medal') }] : [])
    ]

    const hintLabel = mode === 'riddles' ? t('game-quest-form-riddle') : t('game-quest-form-hint')
    // A photo quest's riddle is the first photo of the place: no hints, only places with photos
    const photos = mode === 'photos'

    return (
        <FormSections
            sections={sections}
            label={t('game-quest-form-sections')}
        >
            {serverError && <Message type={'error'}>{serverError}</Message>}

            <FormSection
                id={'texts'}
                title={t('game-quest-form-texts')}
                description={t('game-quest-form-texts-description')}
            >
                <div className={styles.fields}>
                    <Controller
                        name={'title'}
                        control={control}
                        rules={{
                            maxLength: {
                                message: t('game-quest-form-title-long', { max: TITLE_MAX }),
                                value: TITLE_MAX
                            },
                            // A title in one language is enough: the other one is shown in its place
                            validate: (value) => !!value.trim() || !!otherTitle || t('game-quest-form-title-required')
                        }}
                        render={({ field, fieldState }) => (
                            <Input
                                size={'medium'}
                                name={field.name}
                                label={t('game-quest-form-title')}
                                placeholder={t('game-quest-form-title-placeholder')}
                                required={!otherTitle}
                                autoFocus={!quest}
                                disabled={saving}
                                maxLength={TITLE_MAX}
                                value={field.value}
                                error={fieldState.error?.message}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                            />
                        )}
                    />

                    <Controller
                        name={'description'}
                        control={control}
                        render={({ field }) => (
                            <TextArea
                                name={field.name}
                                label={t('game-quest-form-description')}
                                placeholder={t('game-quest-form-description-placeholder')}
                                disabled={saving}
                                maxLength={DESCRIPTION_MAX}
                                rows={4}
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                            />
                        )}
                    />
                </div>
            </FormSection>

            <FormSection
                id={'mode'}
                title={t('game-quest-form-mode')}
                description={t('game-quest-form-mode-description')}
            >
                <Controller
                    name={'mode'}
                    control={control}
                    render={({ field }) => (
                        <OptionList<ApiType.Game.QuestMode>
                            className={styles.modes}
                            groups={[
                                {
                                    items: MODES.map((key) => ({
                                        caption: t(`game-quest-mode-${key}-note`),
                                        icon: <Icon name={QUEST_MODE_ICONS[key]} />,
                                        key,
                                        label: t(`game-quest-mode-${key}`),
                                        selected: field.value === key
                                    }))
                                }
                            ]}
                            onSelect={field.onChange}
                        />
                    )}
                />

                <Controller
                    name={'published'}
                    control={control}
                    render={({ field }) => (
                        <Switch
                            variant={'row'}
                            className={styles.publish}
                            label={t('game-quest-form-published')}
                            description={t('game-quest-form-published-description')}
                            checked={field.value}
                            disabled={saving}
                            onChange={field.onChange}
                        />
                    )}
                />
            </FormSection>

            <FormSection
                id={'points'}
                title={t('game-quest-form-points')}
                description={t('game-quest-form-points-description', { max: POINTS_MAX, min: POINTS_MIN })}
            >
                <div
                    className={styles.points}
                    data-field={'points'}
                >
                    {points.length > 0 && (
                        <ol className={styles.pointList}>
                            {points.map(({ place, hint }, index) => {
                                const address = addressToString(place.address)
                                    ?.map((item) => item.name)
                                    .join(', ')
                                const leg = index
                                    ? formatLength(
                                          haversineDistanceKm(points[index - 1].place, place) * 1000,
                                          i18n.language
                                      )
                                    : undefined

                                return (
                                    <li
                                        key={place.id}
                                        className={styles.point}
                                    >
                                        <div className={styles.pointHead}>
                                            <span className={styles.number}>{index + 1}</span>

                                            <div className={collectionPickerStyles.pickerCover}>
                                                {place.cover ? (
                                                    <Image
                                                        src={`${IMG_HOST}${place.cover.preview}`}
                                                        alt={''}
                                                        fill
                                                        sizes={'40px'}
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <Icon name={'Photo'} />
                                                )}
                                            </div>

                                            <div className={collectionPickerStyles.pickerBody}>
                                                <a
                                                    href={buildPlaceUrl(place.id, place.slug)}
                                                    target={'_blank'}
                                                    rel={'noopener noreferrer'}
                                                    className={styles.pointTitle}
                                                >
                                                    {place.title}
                                                </a>
                                                <span>
                                                    {[
                                                        photos && !place.photos && t('game-quest-form-no-photo'),
                                                        leg && t('game-quest-form-leg', { length: leg }),
                                                        place.category
                                                            ? getCategoryTitle(t, place.category)
                                                            : undefined,
                                                        address
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                            </div>

                                            <div className={styles.pointActions}>
                                                <Button
                                                    mode={'outline'}
                                                    size={'small'}
                                                    icon={'KeyboardUp'}
                                                    disabled={saving || index === 0}
                                                    tooltip={t('game-quest-form-move-up')}
                                                    onClick={() => movePoint(index, -1)}
                                                />
                                                <Button
                                                    mode={'outline'}
                                                    size={'small'}
                                                    icon={'KeyboardDown'}
                                                    disabled={saving || index === points.length - 1}
                                                    tooltip={t('game-quest-form-move-down')}
                                                    onClick={() => movePoint(index, 1)}
                                                />
                                                <Button
                                                    mode={'outline'}
                                                    size={'small'}
                                                    icon={'Close'}
                                                    disabled={saving}
                                                    tooltip={t('game-quest-form-remove')}
                                                    onClick={() =>
                                                        setPoints((list) => list.filter((_, i) => i !== index))
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {!photos && (
                                            <div className={styles.hints}>
                                                <Input
                                                    size={'medium'}
                                                    placeholder={hintLabel}
                                                    aria-label={`${hintLabel}: ${place.title}`}
                                                    disabled={saving}
                                                    maxLength={HINT_MAX}
                                                    value={hint}
                                                    onChange={(event) => changeHint(index, event.target.value)}
                                                />
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                        </ol>
                    )}

                    {points.length > 1 && (
                        <p className={styles.total}>
                            {t('game-quest-form-total', {
                                count: points.length,
                                length: formatLength(length, i18n.language)
                            })}
                        </p>
                    )}

                    {pointsError && <p className={styles.error}>{pointsError}</p>}

                    <div className={styles.search}>
                        <Input
                            size={'medium'}
                            label={t('game-quest-form-add')}
                            placeholder={t('game-quest-form-search-placeholder')}
                            disabled={saving || points.length >= POINTS_MAX}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />

                        {canSearch &&
                            (!found && searching ? (
                                <ul className={collectionPickerStyles.pickerList}>
                                    {[0, 1, 2].map((i) => (
                                        <li
                                            key={i}
                                            className={collectionPickerStyles.pickerRow}
                                            aria-hidden={true}
                                        >
                                            <Skeleton style={{ height: 40, width: 40 }} />
                                            <div className={collectionPickerStyles.pickerBody}>
                                                <Skeleton style={{ height: 14, marginBottom: 6, width: '60%' }} />
                                                <Skeleton style={{ height: 12, width: '40%' }} />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : results?.length ? (
                                <ul
                                    className={cn(
                                        collectionPickerStyles.pickerList,
                                        searching && collectionPickerStyles.pickerListFetching
                                    )}
                                >
                                    {results.map((place) => (
                                        <li
                                            key={place.id}
                                            className={cn(
                                                collectionPickerStyles.pickerRow,
                                                collectionPickerStyles.pickerRowStatic
                                            )}
                                        >
                                            <div className={collectionPickerStyles.pickerCover}>
                                                {place.cover ? (
                                                    <Image
                                                        src={`${IMG_HOST}${place.cover.preview}`}
                                                        alt={''}
                                                        fill
                                                        sizes={'40px'}
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <Icon name={'Photo'} />
                                                )}
                                            </div>
                                            <div className={collectionPickerStyles.pickerBody}>
                                                <strong>{place.title}</strong>
                                                <span>
                                                    {[
                                                        photos && !place.photos && t('game-quest-form-no-photo'),
                                                        place.category
                                                            ? getCategoryTitle(t, place.category)
                                                            : undefined,
                                                        addressToString(place.address)
                                                            ?.map((item) => item.name)
                                                            .join(', ')
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                            </div>
                                            <Button
                                                mode={'secondary'}
                                                size={'small'}
                                                icon={'PlusCircle'}
                                                label={t('game-quest-form-add-button')}
                                                disabled={photos && !place.photos}
                                                onClick={() => addPoint(place)}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.empty}>{t('game-quest-form-search-empty')}</p>
                            ))}
                    </div>
                </div>
            </FormSection>

            {quest && (
                <FormSection
                    id={'medal'}
                    title={t('game-quest-form-medal')}
                    description={t('game-quest-form-medal-description')}
                >
                    <ul className={styles.medal}>
                        <ImageSlot
                            id={'quest-medal'}
                            label={t('game-quest-form-medal-label')}
                            hasImage={!!quest.medal}
                            preview={
                                <QuestMedal
                                    quest={quest}
                                    size={64}
                                />
                            }
                            onUpload={(file) => uploadMedal({ file, id: quest.id }).unwrap()}
                            onRemove={() => removeMedal(quest.id).unwrap()}
                        />
                    </ul>
                </FormSection>
            )}

            <FormActions
                dirty={dirty}
                loading={saving}
                saveLabel={quest ? undefined : t('game-quest-form-create')}
                saveDisabled={quest ? undefined : saving}
                deleteLabel={t('game-quest-form-delete')}
                deleteDisabled={saving || deleting}
                onDelete={quest ? () => setDeleteOpen(true) : undefined}
                onSave={() => void handleSubmit(onSubmit, (errors) => scrollToFirstError(errors))()}
                onCancel={() =>
                    confirmDiscard(() => {
                        allowNavigation()
                        void router.push(quest ? questHref(quest.id, quest.slug) : QUESTS_HREF)
                    })
                }
            />

            <ConfirmationDialog {...dialogProps} />

            {quest && (
                <ConfirmationDialog
                    open={deleteOpen}
                    message={t('game-quest-form-delete-confirm', { title: quest.title })}
                    confirmLabel={t('game-quest-form-delete')}
                    onConfirm={() => void handleDelete()}
                    onCancel={() => setDeleteOpen(false)}
                />
            )}
        </FormSections>
    )
}
