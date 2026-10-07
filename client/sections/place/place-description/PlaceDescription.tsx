import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import Markdown from 'react-markdown'
import debounce from 'lodash-es/debounce'
import { Button, Container, Select, SelectOptionType } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
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

    const [editorMode, setEditorMode] = useState<boolean>(false)
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

    return (
        <Container
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
                <div className={styles.content}>
                    <Markdown>{localContent}</Markdown>
                </div>
            ) : (
                <div className={styles.emptyContent}>{t('description-not-added-yet')}</div>
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
        </Container>
    )
}
