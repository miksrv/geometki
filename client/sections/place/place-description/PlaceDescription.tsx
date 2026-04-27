import React, { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { Button, Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { ChipsSelect, ContentEditor, ScreenSpinner } from '@/components/ui'
import { equalsArrays } from '@/utils/helpers'

import styles from './styles.module.sass'

interface PlaceDescriptionProps {
    placeId?: string
    content?: string
    tags?: string[]
}

export const PlaceDescription: React.FC<PlaceDescriptionProps> = ({ placeId, content, tags }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [updatePlace, { data: saveData, isLoading, isSuccess }] = API.usePlacesPatchItemMutation()

    const [searchTags, { data: searchResult, isLoading: searchLoading }] = API.useTagsGetSearchMutation()

    const [editorMode, setEditorMode] = useState<boolean>(false)
    const [editorTags, setEditorTags] = useState<string[]>()
    const [localTags, setLocalTags] = useState<string[]>()
    const [localContent, setLocalContent] = useState<string | undefined>(content)

    const handleSetEditorClick = () => {
        if (isAuth) {
            setEditorMode(!editorMode)
            setEditorTags(localTags)
        } else {
            dispatch(openAuthDialog())
        }
    }

    const handleSelectTags = (value: string[]) => {
        setEditorTags(value)
    }

    const handleSearchTags = async (value: string) => {
        if (value.length > 0) {
            await searchTags(value)
        }
    }

    const handleSaveEditorClick = async () => {
        await updatePlace({
            content: localContent,
            id: placeId!,
            tags: !equalsArrays(editorTags, localTags) ? editorTags : undefined
        })
    }

    useEffect(() => {
        if (isSuccess && editorMode) {
            setEditorMode(false)
            setLocalContent(saveData.content)

            void dispatch(
                Notify({
                    id: 'placeFormSuccess',
                    message: t('geotag-saved'),
                    type: 'success'
                })
            )

            if (saveData.tags) {
                setLocalTags(saveData.tags)
            }
        }
    }, [saveData])

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
                            onClick={handleSaveEditorClick}
                        />
                        <Button
                            mode={'link'}
                            disabled={isLoading}
                            label={t('cancel')}
                            onClick={handleSetEditorClick}
                        />
                    </>
                ) : (
                    <Button
                        mode={'link'}
                        label={t('edit')}
                        onClick={handleSetEditorClick}
                    />
                )
            }
        >
            {isLoading && <ScreenSpinner />}

            {isAuth && editorMode ? (
                <ContentEditor
                    value={localContent}
                    onChange={setLocalContent}
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
                    <ChipsSelect
                        label={t('select-or-add-geotag-hashtags')}
                        placeholder={t('input_tags-placeholder')}
                        notFoundCaption={t('nothing-found')}
                        value={editorTags}
                        loading={searchLoading}
                        options={searchResult?.items}
                        onSearch={handleSearchTags}
                        onSelect={handleSelectTags}
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
        </Container>
    )
}
