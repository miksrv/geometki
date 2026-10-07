import React, { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, Dialog, Input, Select, SelectOptionType } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog/ConfirmationDialog'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { getErrorMessage } from '@/utils/api'
import { COLLECTION_TITLE_MAX_LENGTH } from '@/utils/helpers'

import styles from '../styles.module.sass'

interface CollectionSettingsDialogProps {
    collection: ApiModel.Collection
    open: boolean
    onClose: () => void
    onDelete?: () => void
}

interface SettingsFormValues {
    title: string
    // The chosen option itself, not just its id: the search results it came from are replaced
    // by the next search, and the select must keep showing the name
    region: SelectOptionType<string> | null
}

const toRegionOption = (region?: ApiModel.CollectionRegion | null): SelectOptionType<string> | null =>
    region ? { key: String(region.id), value: region.name } : null

const toFormValues = (collection: ApiModel.Collection): SettingsFormValues => ({
    region: toRegionOption(collection.region),
    title: collection.title
})

/**
 * Owner settings: title and region. Everything is saved with one "Save"; the description is
 * edited inline on the page. There is no cover setting: cards show a mosaic of the first
 * places' covers, so the author changes it by reordering the places.
 */
export const CollectionSettingsDialog: React.FC<CollectionSettingsDialogProps> = ({
    collection,
    open,
    onClose,
    onDelete
}) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const {
        control,
        formState: { isDirty: isFormDirty },
        handleSubmit,
        reset,
        watch
    } = useForm<SettingsFormValues>({ defaultValues: toFormValues(collection) })

    const title = watch('title')
    const region = watch('region')

    const [patchCollection, { isLoading: saving }] = API.useCollectionsPatchMutation()
    const [searchAddress, { data: addressData }] = API.useLocationGetSearchMutation()

    // Start from the saved values every time the dialog opens
    useEffect(() => {
        if (open) {
            reset(toFormValues(collection))
        }
    }, [open])

    const regionOptions = useMemo<Array<SelectOptionType<string>>>(() => {
        const base = addressData?.regions?.map((item) => ({ key: String(item.id), value: item.name })) ?? []

        if (region && !base.find((option) => option.key === region.key)) {
            base.unshift(region)
        }

        return base
    }, [addressData?.regions, region])

    const trimmedTitle = title.trim()

    const regionId = region ? Number(region.key) : null
    // Compared with the saved values, so typing a title back to what it was is not a change
    const isDirty = isFormDirty && (trimmedTitle !== collection.title || regionId !== (collection.region?.id ?? null))

    const { confirmDiscard, dialogProps: leaveDialogProps } = useUnsavedChangesGuard(open && isDirty)

    const handleClose = () => confirmDiscard(onClose)

    const handleSave = handleSubmit(async () => {
        if (!trimmedTitle || !isDirty || saving) {
            return
        }

        const result = await patchCollection({
            id: collection.id,
            region: regionId,
            title: trimmedTitle
        })

        if ('error' in result) {
            void dispatch(
                Notify({ id: 'collectionSettingsError', message: getErrorMessage(result.error), type: 'error' })
            )
            return
        }

        void dispatch(
            Notify({
                id: 'collectionSettingsSaved',
                title: '',
                message: t('collections_saved', { defaultValue: 'Изменения сохранены' }),
                type: 'success'
            })
        )

        reset({ region, title: trimmedTitle })
        onClose()
    })

    return (
        <>
            <Dialog
                open={open}
                title={t('collections_settings', { defaultValue: 'Настройки коллекции' })}
                contentClassName={styles.settings}
                maxWidth={'520px'}
                // While the discard prompt is open, Esc is its own: the kit dialogs all listen to it
                // on the document, and this one would open the prompt again right after it closes
                onCloseDialog={leaveDialogProps.open ? undefined : handleClose}
            >
                <div className={styles.settingsField}>
                    <Controller
                        name={'title'}
                        control={control}
                        render={({ field }) => (
                            <Input
                                size={'medium'}
                                label={t('collections_title-label', { defaultValue: 'Название' })}
                                value={field.value}
                                disabled={saving}
                                maxLength={COLLECTION_TITLE_MAX_LENGTH}
                                error={!trimmedTitle}
                                onChange={(event) =>
                                    field.onChange(event.target.value.slice(0, COLLECTION_TITLE_MAX_LENGTH))
                                }
                                onBlur={field.onBlur}
                            />
                        )}
                    />
                </div>

                <div className={styles.settingsField}>
                    <Controller
                        name={'region'}
                        control={control}
                        render={({ field }) => (
                            <Select<string>
                                searchable
                                clearable
                                size={'medium'}
                                disabled={saving}
                                label={t('collections_region-label', { defaultValue: 'Регион' })}
                                placeholder={t('collections_region-placeholder', { defaultValue: 'Начните вводить' })}
                                notFoundCaption={t('nothing-found', { defaultValue: 'Ничего не найдено' })}
                                options={regionOptions}
                                value={field.value?.key}
                                onSearch={(value) => void searchAddress(value)}
                                onSelect={(selected) => field.onChange(selected?.[0] ?? null)}
                            />
                        )}
                    />
                    <p className={styles.settingsHint}>
                        {t('collections_theme-hint', {
                            defaultValue: 'По региону подбираются рекомендации мест и фильтруется каталог'
                        })}
                    </p>
                </div>

                <div className={styles.settingsFooter}>
                    <Button
                        mode={'link'}
                        variant={'negative'}
                        disabled={saving}
                        label={t('collections_delete-collection', { defaultValue: 'Удалить коллекцию' })}
                        onClick={onDelete}
                    />
                    <div className={styles.dialogActions}>
                        <Button
                            mode={'secondary'}
                            size={'medium'}
                            disabled={saving}
                            onClick={handleClose}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            mode={'primary'}
                            size={'medium'}
                            disabled={!trimmedTitle || !isDirty || saving}
                            loading={saving}
                            onClick={() => void handleSave()}
                        >
                            {t('save')}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <ConfirmationDialog {...leaveDialogProps} />
        </>
    )
}
