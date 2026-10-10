import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import Markdown from 'react-markdown'
import debounce from 'lodash-es/debounce'
import { Button, cn, Select, SelectOptionType } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Section } from '@/components/shared'
import { ScreenSpinner } from '@/components/ui'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { equalsArrays } from '@/utils/helpers'

import styles from './styles.module.sass'

const ContentEditor = dynamic(
    () => import('@/components/ui/content-editor/ContentEditor').then((m) => ({ default: m.ContentEditor })),
    { ssr: false }
)

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

// Collapsed height of a long description (about 12 lines of prose); shorter texts are never clamped
const CLAMP_HEIGHT = 300
// A markdown source longer than this is almost certainly taller than CLAMP_HEIGHT: the server
// renders the "Читать полностью" control for it right away, so it does not appear after
// hydration and push the page down (CLS); the measurement below corrects the rare miss
const LIKELY_LONG_LENGTH = 800

interface DescriptionFormValues {
    content: string
    tags: string[]
}

interface PlaceDescriptionProps {
    placeId?: string
    content?: string
    tags?: string[]
}

export const PlaceDescription: React.FC<PlaceDescriptionProps> = ({ placeId, content, tags }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [updatePlace, { isLoading }] = API.usePlacesPatchItemMutation()

    const [searchTags, { data: searchResult, isLoading: searchLoading }] = API.useTagsGetSearchMutation()

    const contentRef = useRef<HTMLDivElement>(null)

    const [editorMode, setEditorMode] = useState<boolean>(false)
    // Clamped until measured: the server HTML and the first client render agree, and a
    // short text is simply shorter than the limit. Expanded for good when it fits.
    const [clamped, setClamped] = useState<boolean>(true)
    const [overflows, setOverflows] = useState<boolean>((content?.length ?? 0) > LIKELY_LONG_LENGTH)
    const [localTags, setLocalTags] = useState<string[] | undefined>(tags)
    const [localContent, setLocalContent] = useState<string | undefined>(content)
    const [tagSearch, setTagSearch] = useState('')

    const {
        control,
        formState: { isDirty },
        handleSubmit,
        reset,
        watch
    } = useForm<DescriptionFormValues>({ defaultValues: { content: content ?? '', tags: tags ?? [] } })

    const editorTags = watch('tags')

    const { confirmDiscard, dialogProps: leaveDialogProps } = useUnsavedChangesGuard(editorMode && isDirty)

    const handleEditClick = () => {
        if (!isAuth) {
            dispatch(openAuthDialog())
            return
        }

        reset({ content: localContent ?? '', tags: localTags ?? [] })
        setEditorMode(true)
    }

    const handleCancelClick = () => confirmDiscard(() => setEditorMode(false))

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

    const tagOptions = useMemo<Array<SelectOptionType<string>>>(() => {
        const selected = (editorTags ?? []).map((tag) => ({ key: tag, value: tag }))
        const results = (searchResult?.items ?? []).map((tag) => ({ key: tag, value: tag }))
        const merged = [...selected]
        for (const opt of results) {
            if (!merged.find((m) => m.key === opt.key)) {
                merged.push(opt)
            }
        }
        return merged
    }, [editorTags, searchResult?.items])

    const tagsWithCustom = useMemo<Array<SelectOptionType<string>>>(() => {
        if (!tagSearch || tagOptions.find((opt) => opt.key.toLowerCase() === tagSearch.toLowerCase())) {
            return tagOptions
        }
        return [{ key: tagSearch, value: tagSearch }, ...tagOptions]
    }, [tagOptions, tagSearch])

    const handleSave = handleSubmit(async (values) => {
        const result = await updatePlace({
            content: values.content,
            id: placeId!,
            tags: !equalsArrays(values.tags, localTags) ? values.tags : undefined
        })

        if ('error' in result) {
            return
        }

        setEditorMode(false)
        setLocalContent(result.data?.content)

        if (result.data?.tags) {
            setLocalTags(result.data.tags)
        }

        void dispatch(
            Notify({
                id: 'placeFormSuccess',
                message: t('geotag-saved'),
                type: 'success'
            })
        )
    })

    useEffect(() => {
        setLocalContent(content)
        setLocalTags(tags)
    }, [content, tags])

    useEffect(() => {
        setEditorMode(false)
    }, [placeId])

    useEffect(() => {
        const element = contentRef.current

        if (!element || editorMode) {
            return
        }

        // Strict: a text within the limit is shown whole, a taller one is clamped at the limit
        // exactly, so the toggle never changes the height by a few pixels
        const fits = element.scrollHeight <= CLAMP_HEIGHT

        setOverflows(!fits)

        if (fits) {
            setClamped(false)
        }
    }, [localContent, editorMode])

    return (
        <Section
            className={styles.placeDescription}
            title={t('description')}
            action={
                isAuth && editorMode ? (
                    <>
                        <Button
                            mode={'link'}
                            disabled={isLoading}
                            label={t('save')}
                            onClick={() => void handleSave()}
                        />
                        <Button
                            mode={'link'}
                            disabled={isLoading}
                            label={t('cancel')}
                            onClick={handleCancelClick}
                        />
                    </>
                ) : (
                    <Button
                        mode={'link'}
                        label={t('edit')}
                        onClick={handleEditClick}
                    />
                )
            }
        >
            {isLoading && <ScreenSpinner />}

            {isAuth && editorMode ? (
                <Controller
                    name={'content'}
                    control={control}
                    render={({ field }) => (
                        <ContentEditor
                            value={field.value}
                            onChange={(text) => field.onChange(text || '')}
                        />
                    )}
                />
            ) : localContent ? (
                <>
                    <div
                        ref={contentRef}
                        className={cn(styles.content, clamped && styles.clamped)}
                    >
                        <Markdown>{localContent}</Markdown>
                    </div>
                    {overflows && (
                        <Button
                            unstyled={true}
                            className={styles.readMore}
                            aria-expanded={!clamped}
                            onClick={() => setClamped((prev) => !prev)}
                        >
                            {clamped
                                ? t('read-full-text', { defaultValue: 'Читать полностью' })
                                : t('collapse-text', { defaultValue: 'Свернуть' })}
                        </Button>
                    )}
                </>
            ) : (
                <div className={styles.emptyContent}>
                    {t('description-not-added-yet')}
                    {' · '}
                    <Button
                        mode={'link'}
                        label={t('add', { defaultValue: 'Добавить' })}
                        onClick={handleEditClick}
                    />
                </div>
            )}

            {isAuth && editorMode ? (
                <div className={styles.formElement}>
                    <Controller
                        name={'tags'}
                        control={control}
                        render={({ field }) => (
                            <Select<string>
                                multiple
                                searchable
                                closeOnSelect={false}
                                label={t('select-or-add-geotag-hashtags')}
                                placeholder={t('input_tags-placeholder')}
                                notFoundCaption={t('nothing-found')}
                                value={field.value}
                                loading={searchLoading}
                                options={tagsWithCustom}
                                onSearch={handleSearchTags}
                                onSelect={(selected) => field.onChange(selected?.map((opt) => opt.key) ?? [])}
                            />
                        )}
                    />
                </div>
            ) : (
                !!localTags?.length && (
                    <ul className={styles.tagList}>
                        {localTags.map((tag, i) => (
                            <li key={`tag${i}`}>
                                <Link
                                    href={`/places?tag=${tag}`}
                                    title={`#${tag}`}
                                >
                                    {`#${tag}`}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )
            )}

            <ConfirmationDialog {...leaveDialogProps} />
        </Section>
    )
}
