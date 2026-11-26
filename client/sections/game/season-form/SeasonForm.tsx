import React, { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Message } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { ConfirmationDialog } from '@/components/shared'
import { DateField, FormActions, FormSection, FormSections, LocaleFieldPair } from '@/components/ui'
import type { FormSectionsItem } from '@/components/ui/form-sections'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { applyServerErrors, parseServerErrors } from '@/utils/formErrors'
import { GAME_HREF, seasonEditHref, seasonHref } from '@/utils/game'
import { scrollToFirstError } from '@/utils/scrollToFirstError'

import { SeasonImages } from './SeasonImages'

import styles from './styles.module.sass'

type SeasonInput = Required<ApiType.Game.SeasonInput>

const TITLE_MAX = 150
const DESCRIPTION_MAX = 5000

const FIELDS = ['title_ru', 'title_en', 'description_ru', 'description_en', 'starts_on', 'ends_on'] as const

interface SeasonFormProps {
    /** The season to edit (`GET game/seasons/manage/:id`); a new one without it */
    season?: ApiType.Game.SeasonAdmin
}

const toValues = (season?: ApiType.Game.SeasonAdmin): SeasonInput => ({
    description_en: season?.description_en ?? '',
    description_ru: season?.description_ru ?? '',
    ends_on: season?.ends_on.slice(0, 10) ?? '',
    starts_on: season?.starts_on.slice(0, 10) ?? '',
    title_en: season?.title_en ?? '',
    title_ru: season?.title_ru ?? ''
})

/**
 * The form of a season, a page of the site for the administrators (`/game/seasons/create`,
 * `/game/seasons/:id/edit`), like the quest form: the title and the description in both
 * languages (the id is the server's, random); the first and the last day (locked once the
 * season is closed); and, on an existing season, its medal (the season's picture) and its
 * variants for the places 1–3 — the parts in `FormSections`, a menu on the left like the place
 * form. The days are chosen in the kit's calendar (`DateField`). Create / save / delete are the
 * form's own: server errors go under their fields, the rest at the top; "Удалить" only while the
 * season has not begun.
 * A new season goes on to its edit page for the pictures, a saved one back to where it is shown.
 */
export const SeasonForm: React.FC<SeasonFormProps> = ({ season }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const dispatch = useAppDispatch()
    const isCreate = !season
    // The server's rules: the dates are frozen once the season is closed or past its grace days, the start once anything is counted
    const datesLocked = !!season?.datesLocked
    const startLocked = !!season?.startLocked

    const [createSeason, { isLoading: creating }] = API.useGamePostSeasonMutation()
    const [updateSeason, { isLoading: updating }] = API.useGamePatchSeasonMutation()
    const [deleteSeason, { isLoading: deleting }] = API.useGameDeleteSeasonMutation()

    const {
        control,
        formState: { isDirty },
        handleSubmit,
        setError,
        watch
    } = useForm<SeasonInput>({ defaultValues: toValues(season) })

    const [serverError, setServerError] = useState<string>()
    const [deleteOpen, setDeleteOpen] = useState<boolean>(false)

    const startsOn = watch('starts_on')
    // Saved and on the way out: the form stays off so a second click does not save it again
    const [leaving, setLeaving] = useState<boolean>(false)
    const saving = creating || updating || leaving
    const { allowNavigation, confirmDiscard, dialogProps } = useUnsavedChangesGuard(isDirty)

    const fail = (error: unknown) => {
        const { fields, message } = parseServerErrors(error, FIELDS)

        applyServerErrors(setError, fields)
        setServerError(message ?? (Object.keys(fields).length ? undefined : t('error')))
    }

    const onSubmit = async (values: SeasonInput) => {
        setServerError(undefined)

        try {
            const saved = !season
                ? await createSeason(values).unwrap()
                : await updateSeason({ body: values, id: season.id }).unwrap()

            void dispatch(Notify({ id: 'adminSaved', message: t('admin-saved'), title: '', type: 'success' }))

            setLeaving(true)
            allowNavigation()
            // The pictures are added on the edit page of the new season
            await router.push(isCreate ? seasonEditHref(saved.id) : seasonHref(saved.id, saved.slug, saved.current))
        } catch (error) {
            fail(error)
        }
    }

    const handleDelete = async () => {
        if (!season) {
            return
        }

        setDeleteOpen(false)

        try {
            await deleteSeason(season.id).unwrap()

            void dispatch(Notify({ id: 'adminSaved', message: t('admin-deleted'), title: '', type: 'success' }))

            setLeaving(true)
            allowNavigation()
            await router.push(GAME_HREF)
        } catch (error) {
            fail(error)
        }
    }

    // Only a season still to come can go: one that has begun is a part of the history
    const canDelete = !!season?.upcoming

    const sections: FormSectionsItem[] = [
        { icon: 'Pencil', key: 'texts', title: t('game-season-form-section-texts') },
        { icon: 'Calendar', key: 'dates', title: t('game-season-form-section-dates') },
        ...(season ? [{ icon: 'Photo', key: 'images', title: t('game-season-form-images') } as FormSectionsItem] : [])
    ]

    return (
        <FormSections
            sections={sections}
            label={t('game-season-form-sections')}
        >
            {serverError && <Message type={'error'}>{serverError}</Message>}

            <FormSection
                id={'texts'}
                title={t('game-season-form-section-texts')}
            >
                <div className={styles.fields}>
                    <LocaleFieldPair
                        control={control}
                        names={['title_ru', 'title_en']}
                        label={t('game-season-form-title')}
                        required={{ ru: true }}
                        maxLength={TITLE_MAX}
                        disabled={saving}
                    />

                    <LocaleFieldPair
                        control={control}
                        names={['description_ru', 'description_en']}
                        label={t('description')}
                        rows={4}
                        maxLength={DESCRIPTION_MAX}
                        disabled={saving}
                    />
                </div>
            </FormSection>

            <FormSection
                id={'dates'}
                title={t('game-season-form-section-dates')}
            >
                <div className={styles.dates}>
                    <Controller
                        name={'starts_on'}
                        control={control}
                        rules={{
                            deps: ['ends_on'],
                            validate: (value) => !!value || t('admin-field-required')
                        }}
                        render={({ field, fieldState }) => (
                            <DateField
                                label={t('game-season-form-starts')}
                                required={true}
                                disabled={startLocked || saving}
                                value={field.value}
                                error={fieldState.error?.message}
                                onChange={(value) => field.onChange(value)}
                            />
                        )}
                    />

                    <Controller
                        name={'ends_on'}
                        control={control}
                        rules={{
                            validate: (value, values) =>
                                !value
                                    ? t('admin-field-required')
                                    : !values.starts_on || value >= values.starts_on || t('admin-dates-order')
                        }}
                        render={({ field, fieldState }) => (
                            <DateField
                                label={t('game-season-form-ends')}
                                required={true}
                                disabled={datesLocked || saving}
                                minDate={startsOn || undefined}
                                value={field.value}
                                error={fieldState.error?.message}
                                onChange={(value) => field.onChange(value)}
                            />
                        )}
                    />
                </div>
            </FormSection>

            {season && (
                <FormSection
                    id={'images'}
                    title={t('game-season-form-images')}
                    description={t('game-season-form-images-description')}
                >
                    <SeasonImages season={season} />
                </FormSection>
            )}

            <FormActions
                dirty={isDirty}
                loading={saving || deleting}
                saveDisabled={isCreate ? false : undefined}
                saveLabel={isCreate ? t('game-season-add') : undefined}
                onSave={() => void handleSubmit(onSubmit, (errors) => scrollToFirstError(errors))()}
                onCancel={() =>
                    confirmDiscard(
                        () => void router.push(season ? seasonHref(season.id, season.slug, season.current) : GAME_HREF)
                    )
                }
                onDelete={canDelete ? () => setDeleteOpen(true) : undefined}
            />

            <ConfirmationDialog {...dialogProps} />
            <ConfirmationDialog
                open={deleteOpen}
                message={t('game-season-form-delete-confirm')}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteOpen(false)}
            />
        </FormSections>
    )
}
