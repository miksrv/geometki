import React, { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Button, Input, Message, Select } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { AchievementIcon, ConfirmationDialog, ImageSlot } from '@/components/shared'
import { FieldHint, FormActions, FormSection, HintedField, LocaleFieldPair, Switch } from '@/components/ui'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { getCategoryOptions } from '@/utils/categories'
import { applyServerErrors, parseServerErrors } from '@/utils/formErrors'
import { scrollToFirstError } from '@/utils/scrollToFirstError'

import styles from './styles.module.sass'

type Achievement = ApiType.Achievements.AchievementAdmin
type Rule = ApiType.Achievements.AchievementRule
type AchievementInput = ApiType.Achievements.AchievementInput

export const ACHIEVEMENTS_ADMIN_HREF = '/admin/achievements'

export const METRICS = [
    'places_created',
    'spots_opened',
    'places_edited',
    'places_visited',
    'places_confirmed',
    'quests_walked',
    'places_revisited',
    'visits_total',
    'winter_visits',
    'first_visit_of_year',
    'photos_uploaded',
    'ratings_given',
    'comments_written',
    'bookmarks_added',
    'reputation_score',
    'experience_total',
    'days_active',
    'login_streak',
    'level_reached'
]
const TIERS: ApiType.Achievements.AchievementTier[] = ['none', 'bronze', 'silver', 'gold']
const TYPES: ApiType.Achievements.AchievementType[] = ['base', 'seasonal']

const FIELDS = [
    'group_slug',
    'title_ru',
    'title_en',
    'description_ru',
    'description_en',
    'type',
    'tier',
    'season_start',
    'season_end',
    'xp_bonus',
    'sort_order'
] as const

/** What the fields hold while they are edited: a number is a string, so that clearing it does not snap it to 0 */
interface FormRule extends Omit<Rule, 'value'> {
    value: string
}

interface FormValues extends Omit<AchievementInput, 'xp_bonus' | 'sort_order' | 'rules' | 'image'> {
    xp_bonus: string
    sort_order: string
    rules: FormRule[]
}

const NEW_RULE: FormRule = { metric: 'places_created', operator: '>=', value: '1' }

const toValues = (achievement?: Achievement): FormValues => ({
    description_en: achievement?.description_en ?? '',
    description_ru: achievement?.description_ru ?? '',
    group_slug: achievement?.group_slug ?? '',
    is_active: achievement?.is_active ?? true,
    rules: achievement
        ? (achievement.rules ?? []).map((rule) => ({ ...rule, value: String(rule.value) }))
        : [{ ...NEW_RULE }],
    season_end: achievement?.season_end?.slice(0, 10) ?? null,
    season_start: achievement?.season_start?.slice(0, 10) ?? null,
    sort_order: String(achievement?.sort_order ?? 0),
    tier: achievement?.tier ?? 'none',
    title_en: achievement?.title_en ?? '',
    title_ru: achievement?.title_ru ?? '',
    type: achievement?.type ?? 'base',
    xp_bonus: String(achievement?.xp_bonus ?? 0)
})

const toInt = (value: string): number => parseInt(value, 10) || 0

/** The API's body: the picture is not in it, it is saved by its own upload */
const toInput = (values: FormValues): AchievementInput => ({
    ...values,
    group_slug: values.group_slug?.trim() ?? '',
    rules: values.rules.map((rule) => ({ ...rule, value: toInt(rule.value) })),
    sort_order: toInt(values.sort_order),
    xp_bonus: toInt(values.xp_bonus)
})

interface AchievementFormProps {
    /** The achievement to edit (a row of `GET achievements/manage`); a new one without it */
    achievement?: Achievement
    /** The achievement is still loading: the edit form stands in its place with every field and button off */
    loading?: boolean
}

/**
 * The form of an achievement for the administrator (DESIGN.md → Admin), a page form in parts:
 * the group and the texts in both languages; the tier, type and whether it is on; the
 * season window of a seasonal one; the experience and the picture (an existing achievement
 * only); the rules (at least one). Create / save / delete are the form's own: the failures go
 * at the top or under their fields, "Удалить" is in the actions row.
 */
export const AchievementForm: React.FC<AchievementFormProps> = ({ achievement, loading }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const dispatch = useAppDispatch()
    const isCreate = !achievement && !loading

    const [createAchievement, { isLoading: creating }] = API.useCreateAchievementMutation()
    const [updateAchievement, { isLoading: updating }] = API.useUpdateAchievementMutation()
    const [deleteAchievement, { isLoading: deleting }] = API.useDeleteAchievementMutation()
    const [uploadImage] = API.useUploadAchievementImageMutation()

    const {
        control,
        formState: { errors, isDirty },
        handleSubmit,
        setError,
        setValue,
        watch
    } = useForm<FormValues>({ defaultValues: toValues(achievement) })

    const {
        fields: ruleFields,
        append,
        remove
    } = useFieldArray({
        control,
        name: 'rules',
        rules: { minLength: { message: t('achievements-admin-rules-required'), value: 1 } }
    })

    const [serverError, setServerError] = useState<string>()
    const [deleteOpen, setDeleteOpen] = useState<boolean>(false)

    const type = watch('type')
    const seasonal = type === 'seasonal'
    // Saved and on the way out: the form stays off so a second click does not save it again
    const [leaving, setLeaving] = useState<boolean>(false)
    const saving = creating || updating || leaving
    // Off while the achievement loads or a write is under way
    const busy = saving || !!loading
    const { allowNavigation, confirmDiscard, dialogProps } = useUnsavedChangesGuard(isDirty)

    const categoryOptions = [
        { key: '', value: t('achievements-admin-filter-all') },
        ...getCategoryOptions(t).map((option) => ({ key: option.key as string, value: option.value }))
    ]

    const metricOptions = (current: string) =>
        (METRICS.includes(current) ? METRICS : [...METRICS, current]).map((metric) => ({
            key: metric,
            value: METRICS.includes(metric) ? t(`achievements-metric-${metric}`) : metric
        }))

    const fail = (error: unknown) => {
        const { fields, message } = parseServerErrors(error, FIELDS)

        applyServerErrors(setError, fields)
        setServerError(message ?? (Object.keys(fields).length ? undefined : t('error')))
    }

    const onSubmit = async (values: FormValues) => {
        setServerError(undefined)

        try {
            const body = toInput(values)

            if (achievement) {
                await updateAchievement({ body, id: achievement.id }).unwrap()
            } else {
                await createAchievement(body).unwrap()
            }

            void dispatch(Notify({ id: 'adminSaved', message: t('admin-saved'), title: '', type: 'success' }))

            setLeaving(true)
            allowNavigation()
            await router.push(ACHIEVEMENTS_ADMIN_HREF)
        } catch (error) {
            fail(error)
        }
    }

    const handleDelete = async () => {
        if (!achievement) {
            return
        }

        setDeleteOpen(false)

        try {
            await deleteAchievement(achievement.id).unwrap()

            void dispatch(Notify({ id: 'adminSaved', message: t('admin-deleted'), title: '', type: 'success' }))

            setLeaving(true)
            allowNavigation()
            await router.push(ACHIEVEMENTS_ADMIN_HREF)
        } catch (error) {
            fail(error)
        }
    }

    const rulesError = errors.rules?.root?.message ?? errors.rules?.message

    return (
        <div className={styles.form}>
            {serverError && <Message type={'error'}>{serverError}</Message>}

            <FormSection
                id={'identity'}
                title={t('achievements-admin-section-identity')}
                description={t('achievements-admin-section-identity-description')}
            >
                <div className={styles.fields}>
                    <Controller
                        name={'group_slug'}
                        control={control}
                        render={({ field, fieldState }) => (
                            <HintedField
                                id={'achievement-group'}
                                hint={t('achievements-admin-group-slug-hint')}
                            >
                                {(describedBy) => (
                                    <Input
                                        size={'medium'}
                                        name={field.name}
                                        label={t('achievements-admin-group-slug')}
                                        placeholder={'explorer'}
                                        disabled={busy}
                                        aria-describedby={describedBy}
                                        value={field.value ?? ''}
                                        error={fieldState.error?.message}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                    />
                                )}
                            </HintedField>
                        )}
                    />

                    <LocaleFieldPair
                        control={control}
                        names={['title_ru', 'title_en']}
                        label={t('achievements-admin-name')}
                        required={{ en: true, ru: true }}
                        maxLength={150}
                        disabled={busy}
                        autoFocus={isCreate}
                    />

                    <LocaleFieldPair
                        control={control}
                        names={['description_ru', 'description_en']}
                        label={t('description')}
                        rows={2}
                        disabled={busy}
                    />
                </div>
            </FormSection>

            <FormSection
                id={'classification'}
                title={t('achievements-admin-section-classification')}
                description={t('achievements-admin-section-classification-description')}
            >
                <div className={styles.fields}>
                    <div className={styles.row}>
                        <Controller
                            name={'type'}
                            control={control}
                            render={({ field }) => (
                                <div data-field={field.name}>
                                    <Select
                                        label={t('achievements-admin-type')}
                                        options={TYPES.map((key) => ({ key, value: t(`achievements-${key}`) }))}
                                        value={field.value}
                                        disabled={busy}
                                        onSelect={(options) => {
                                            const next = (options?.[0]?.key ??
                                                'base') as ApiType.Achievements.AchievementType

                                            field.onChange(next)

                                            // A permanent achievement has no window: the dates do not stay behind
                                            if (next === 'base') {
                                                setValue('season_start', null, { shouldDirty: true })
                                                setValue('season_end', null, { shouldDirty: true })
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        />
                    </div>

                    <Controller
                        name={'tier'}
                        control={control}
                        render={({ field }) => (
                            <HintedField
                                id={'achievement-tier'}
                                hint={t('achievements-admin-tier-hint')}
                            >
                                {() => (
                                    <div data-field={field.name}>
                                        <Select
                                            label={t('achievements-admin-tier')}
                                            options={TIERS.map((key) => ({
                                                key,
                                                value: t(`achievements-tier-${key}`)
                                            }))}
                                            value={field.value}
                                            disabled={busy}
                                            onSelect={(options) =>
                                                field.onChange(
                                                    (options?.[0]?.key ??
                                                        'none') as ApiType.Achievements.AchievementTier
                                                )
                                            }
                                        />
                                    </div>
                                )}
                            </HintedField>
                        )}
                    />

                    <Controller
                        name={'sort_order'}
                        control={control}
                        rules={{
                            validate: (value) => value === '' || /^-?\d+$/.test(value) || t('admin-field-integer')
                        }}
                        render={({ field, fieldState }) => (
                            <HintedField
                                id={'achievement-sort'}
                                hint={t('achievements-admin-sort-order-hint')}
                            >
                                {(describedBy) => (
                                    <Input
                                        size={'medium'}
                                        type={'number'}
                                        name={field.name}
                                        label={t('achievements-admin-sort-order')}
                                        disabled={busy}
                                        aria-describedby={describedBy}
                                        value={field.value}
                                        error={fieldState.error?.message}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                    />
                                )}
                            </HintedField>
                        )}
                    />

                    <Controller
                        name={'is_active'}
                        control={control}
                        render={({ field }) => (
                            <Switch
                                variant={'row'}
                                label={t('achievements-admin-active')}
                                description={t('achievements-admin-active-description')}
                                checked={!!field.value}
                                disabled={busy}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </div>
            </FormSection>

            {seasonal && (
                <FormSection
                    id={'window'}
                    title={t('achievements-admin-section-window')}
                    description={t('achievements-admin-section-window-description')}
                >
                    <div className={styles.row}>
                        <Controller
                            name={'season_start'}
                            control={control}
                            rules={{ deps: ['season_end'] }}
                            render={({ field, fieldState }) => (
                                <Input
                                    size={'medium'}
                                    type={'date'}
                                    name={field.name}
                                    label={t('achievements-admin-season-start')}
                                    disabled={busy}
                                    value={field.value ?? ''}
                                    error={fieldState.error?.message}
                                    onChange={(event) => field.onChange(event.target.value || null)}
                                    onBlur={field.onBlur}
                                />
                            )}
                        />
                        <Controller
                            name={'season_end'}
                            control={control}
                            rules={{
                                validate: (value, values) =>
                                    !value ||
                                    !values.season_start ||
                                    value >= values.season_start ||
                                    t('admin-dates-order')
                            }}
                            render={({ field, fieldState }) => (
                                <Input
                                    size={'medium'}
                                    type={'date'}
                                    name={field.name}
                                    label={t('achievements-admin-season-end')}
                                    disabled={busy}
                                    value={field.value ?? ''}
                                    error={fieldState.error?.message}
                                    onChange={(event) => field.onChange(event.target.value || null)}
                                    onBlur={field.onBlur}
                                />
                            )}
                        />
                    </div>
                </FormSection>
            )}

            <FormSection
                id={'reward'}
                title={t('achievements-admin-section-reward')}
                description={t('achievements-admin-section-reward-description')}
            >
                <div className={styles.fields}>
                    <Controller
                        name={'xp_bonus'}
                        control={control}
                        rules={{
                            validate: (value) => value === '' || /^\d+$/.test(value) || t('admin-field-natural')
                        }}
                        render={({ field, fieldState }) => (
                            <HintedField
                                id={'achievement-xp'}
                                hint={t('achievements-admin-xp-bonus-hint')}
                            >
                                {(describedBy) => (
                                    <Input
                                        size={'medium'}
                                        type={'number'}
                                        min={0}
                                        name={field.name}
                                        label={t('achievements-admin-xp-bonus')}
                                        disabled={busy}
                                        aria-describedby={describedBy}
                                        value={field.value}
                                        error={fieldState.error?.message}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                    />
                                )}
                            </HintedField>
                        )}
                    />

                    {achievement ? (
                        <ul className={styles.slot}>
                            <ImageSlot
                                id={`achievement-${achievement.id}`}
                                label={t('achievements-admin-image')}
                                hasImage={!!achievement.image}
                                preview={
                                    <AchievementIcon
                                        image={achievement.image}
                                        alt={''}
                                        size={64}
                                        tier={achievement.tier}
                                        category={achievement.type === 'seasonal' ? 'seasonal' : undefined}
                                        group={achievement.group_slug}
                                    />
                                }
                                onUpload={(file) => uploadImage({ file, id: achievement.id }).unwrap()}
                            />
                        </ul>
                    ) : (
                        !loading && <FieldHint>{t('achievements-admin-image-after-create')}</FieldHint>
                    )}
                </div>
            </FormSection>

            <FormSection
                id={'rules'}
                title={t('achievements-admin-rules')}
                description={t('achievements-admin-rules-description')}
            >
                <div
                    className={styles.rules}
                    data-field={'rules.root'}
                >
                    {ruleFields.map((rule, index) => (
                        <div
                            key={rule.id}
                            className={styles.rule}
                        >
                            <Controller
                                name={`rules.${index}.metric`}
                                control={control}
                                render={({ field }) => (
                                    <div data-field={field.name}>
                                        <Select
                                            label={t('achievements-admin-rule-metric')}
                                            options={metricOptions(field.value)}
                                            value={field.value}
                                            disabled={busy}
                                            onSelect={(options) => field.onChange(options?.[0]?.key ?? METRICS[0])}
                                        />
                                    </div>
                                )}
                            />

                            <Controller
                                name={`rules.${index}.value`}
                                control={control}
                                rules={{
                                    validate: (value) =>
                                        (/^\d+$/.test(value) && Number(value) >= 1) ||
                                        t('achievements-admin-rule-value-invalid')
                                }}
                                render={({ field, fieldState }) => (
                                    <Input
                                        size={'medium'}
                                        type={'number'}
                                        min={1}
                                        name={field.name}
                                        label={t('achievements-admin-rule-value')}
                                        disabled={busy}
                                        value={field.value}
                                        error={fieldState.error?.message}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                    />
                                )}
                            />

                            <Controller
                                name={`rules.${index}.filter`}
                                control={control}
                                render={({ field }) => (
                                    <div data-field={field.name}>
                                        <Select
                                            label={t('achievements-admin-rule-category')}
                                            options={categoryOptions}
                                            value={field.value?.category_id ?? ''}
                                            disabled={busy}
                                            onSelect={(options) => {
                                                const category = options?.[0]?.key ?? ''
                                                // The other filters of a rule (season, quest) are not this form's: kept
                                                const { category_id: _previous, ...rest } = field.value ?? {}
                                                const next = category ? { ...rest, category_id: category } : rest

                                                field.onChange(Object.keys(next).length ? next : undefined)
                                            }}
                                        />
                                    </div>
                                )}
                            />

                            <Button
                                mode={'secondary'}
                                variant={'negative'}
                                size={'medium'}
                                icon={'Close'}
                                disabled={busy}
                                className={styles.removeRule}
                                aria-label={t('achievements-admin-remove-rule', { number: index + 1 })}
                                tooltip={t('achievements-admin-remove-rule', { number: index + 1 })}
                                onClick={() => remove(index)}
                            />
                        </div>
                    ))}

                    {rulesError && (
                        <p
                            className={styles.error}
                            role={'alert'}
                        >
                            {rulesError}
                        </p>
                    )}

                    <div>
                        <Button
                            mode={'outline'}
                            size={'medium'}
                            icon={'PlusCircle'}
                            disabled={busy}
                            label={t('achievements-admin-add-rule')}
                            onClick={() => append({ ...NEW_RULE })}
                        />
                    </div>
                </div>
            </FormSection>

            <FormActions
                dirty={isDirty}
                loading={saving || deleting}
                disabled={loading}
                saveDisabled={isCreate ? false : undefined}
                saveLabel={isCreate ? t('achievements-admin-add') : undefined}
                onSave={() => void handleSubmit(onSubmit, (formErrors) => scrollToFirstError(formErrors))()}
                onCancel={() => confirmDiscard(() => void router.push(ACHIEVEMENTS_ADMIN_HREF))}
                onDelete={achievement ? () => setDeleteOpen(true) : undefined}
            />

            <ConfirmationDialog {...dialogProps} />
            <ConfirmationDialog
                open={deleteOpen}
                message={t('achievements-admin-delete-confirm')}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteOpen(false)}
            />
        </div>
    )
}
