import React, { useEffect, useMemo } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Button, Input, Select, TextArea } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import { getCategoryOptions } from '@/utils/categories'

import styles from './styles.module.sass'

type AchievementInput = ApiType.Achievements.AchievementInput

const METRICS = [
    'places_created',
    'places_edited',
    'places_visited',
    'photos_uploaded',
    'ratings_given',
    'comments_written',
    'bookmarks_added',
    'reputation_score',
    'days_active',
    'login_streak',
    'level_reached'
]
const CATEGORIES: ApiType.Achievements.AchievementCategory[] = [
    'exploration',
    'content',
    'social',
    'reputation',
    'consistency',
    'seasonal'
]
const TIERS: ApiType.Achievements.AchievementTier[] = ['none', 'bronze', 'silver', 'gold']
const TYPES: ApiType.Achievements.AchievementType[] = ['base', 'seasonal']

interface AchievementFormProps {
    defaultValues: AchievementInput
    isLoading: boolean
    /** Whether an image upload is in progress — only relevant when onImageUpload is provided */
    isUploading?: boolean
    onSubmit: (values: AchievementInput) => void
    /** If provided, the image upload block is rendered; resolves to the uploaded image path */
    onImageUpload?: (file: File) => Promise<string | undefined>
    /** Reports whether the form holds changes that would be lost on leaving */
    onDirtyChange?: (isDirty: boolean) => void
}

const toNumber = (value: string) => parseInt(value, 10) || 0

const AchievementForm: React.FC<AchievementFormProps> = ({
    defaultValues,
    isLoading,
    isUploading,
    onSubmit,
    onImageUpload,
    onDirtyChange
}) => {
    const { t } = useTranslation()

    const {
        control,
        formState: { isDirty },
        handleSubmit,
        setValue,
        watch
    } = useForm<AchievementInput>({ defaultValues })

    const { fields: ruleFields, append, remove } = useFieldArray({ control, name: 'rules' })

    const type = watch('type')
    const image = watch('image')
    const rules = watch('rules')
    const titleRu = watch('title_ru')
    const titleEn = watch('title_en')

    const categoryOptions = useMemo(
        () => [
            { key: '', value: t('achievements-admin-filter-all') },
            ...getCategoryOptions(t).map((option) => ({ key: option.key as string, value: option.value }))
        ],
        [t]
    )

    const rulesJson = useMemo(() => JSON.stringify(rules, null, 2), [JSON.stringify(rules)])

    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || !onImageUpload) {
            return
        }
        const uploaded = await onImageUpload(file)
        if (uploaded) {
            setValue('image', uploaded, { shouldDirty: true })
        }
    }

    useEffect(() => {
        onDirtyChange?.(isDirty)
    }, [isDirty])

    return (
        <div className={styles.formGrid}>
            <Controller
                name={'group_slug'}
                control={control}
                render={({ field }) => (
                    <Input
                        label={t('achievements-admin-group-slug')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder={'explorer'}
                        size={'medium'}
                    />
                )}
            />

            <div className={styles.formRow}>
                <Controller
                    name={'title_ru'}
                    control={control}
                    render={({ field }) => (
                        <Input
                            required={true}
                            label={`${t('achievements-admin-name')} 🇷🇺`}
                            value={field.value}
                            onChange={field.onChange}
                            size={'medium'}
                        />
                    )}
                />
                <Controller
                    name={'title_en'}
                    control={control}
                    render={({ field }) => (
                        <Input
                            required={true}
                            label={`${t('achievements-admin-name')} 🇬🇧`}
                            value={field.value}
                            onChange={field.onChange}
                            size={'medium'}
                        />
                    )}
                />
            </div>

            <div className={styles.formRow}>
                <Controller
                    name={'description_ru'}
                    control={control}
                    render={({ field }) => (
                        <TextArea
                            label={`${t('description')} 🇷🇺`}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            rows={2}
                        />
                    )}
                />
                <Controller
                    name={'description_en'}
                    control={control}
                    render={({ field }) => (
                        <TextArea
                            label={`${t('description')} 🇬🇧`}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            rows={2}
                        />
                    )}
                />
            </div>

            <div className={styles.formRow}>
                <Controller
                    name={'category'}
                    control={control}
                    render={({ field }) => (
                        <Select
                            label={t('achievements-admin-category')}
                            options={CATEGORIES.map((c) => ({ key: c, value: t(`achievements-category-${c}`) }))}
                            value={field.value}
                            onSelect={(opts) =>
                                field.onChange(
                                    (opts?.[0]?.key ?? 'exploration') as ApiType.Achievements.AchievementCategory
                                )
                            }
                        />
                    )}
                />

                <Controller
                    name={'tier'}
                    control={control}
                    render={({ field }) => (
                        <Select
                            label={t('achievements-admin-tier')}
                            options={TIERS.map((tier) => ({
                                key: tier,
                                value: t(`achievements-tier-${tier}`, { defaultValue: tier })
                            }))}
                            value={field.value}
                            onSelect={(opts) =>
                                field.onChange((opts?.[0]?.key ?? 'none') as ApiType.Achievements.AchievementTier)
                            }
                        />
                    )}
                />

                <Controller
                    name={'type'}
                    control={control}
                    render={({ field }) => (
                        <Select
                            label={t('achievements-admin-type')}
                            options={TYPES.map((item) => ({ key: item, value: t(`achievements-${item}`) }))}
                            value={field.value}
                            onSelect={(opts) =>
                                field.onChange((opts?.[0]?.key ?? 'base') as ApiType.Achievements.AchievementType)
                            }
                        />
                    )}
                />
            </div>

            {type === 'seasonal' && (
                <div className={styles.formRow}>
                    <Controller
                        name={'season_start'}
                        control={control}
                        render={({ field }) => (
                            <Input
                                label={t('achievements-admin-season-start')}
                                type={'date'}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                                size={'medium'}
                            />
                        )}
                    />
                    <Controller
                        name={'season_end'}
                        control={control}
                        render={({ field }) => (
                            <Input
                                label={t('achievements-admin-season-end')}
                                type={'date'}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                                size={'medium'}
                            />
                        )}
                    />
                </div>
            )}

            <div className={styles.formRow}>
                <Controller
                    name={'xp_bonus'}
                    control={control}
                    render={({ field }) => (
                        <Input
                            label={t('achievements-admin-xp-bonus')}
                            type={'number'}
                            value={String(field.value ?? 0)}
                            onChange={(e) => field.onChange(toNumber(e.target.value))}
                            size={'medium'}
                        />
                    )}
                />

                <Controller
                    name={'sort_order'}
                    control={control}
                    render={({ field }) => (
                        <Input
                            label={t('achievements-admin-sort-order')}
                            type={'number'}
                            value={String(field.value ?? 0)}
                            onChange={(e) => field.onChange(toNumber(e.target.value))}
                            size={'medium'}
                        />
                    )}
                />
            </div>

            {onImageUpload && (
                <div className={styles.formField}>
                    {/* FileUpload: нет в simple-react-ui-kit, используем нативный input */}
                    <label className={styles.label}>
                        {t('achievements-admin-image', { defaultValue: 'Изображение медали (PNG/SVG)' })}
                    </label>
                    <div className={styles.iconRow}>
                        <input
                            type={'file'}
                            accept={'image/png,image/svg+xml'}
                            onChange={(event) => void handleImageChange(event)}
                            disabled={isUploading}
                            className={styles.fileInput}
                        />
                        {image && (
                            <AchievementIcon
                                image={`${IMG_HOST}${image}`}
                                alt={titleRu || titleEn || ''}
                                size={36}
                            />
                        )}
                    </div>
                </div>
            )}

            <div className={styles.formField}>
                <label className={styles.label}>{t('achievements-admin-rules')}</label>
                {ruleFields.map((rule, idx) => (
                    <div
                        key={rule.id}
                        className={styles.ruleRow}
                    >
                        <Controller
                            name={`rules.${idx}.metric`}
                            control={control}
                            render={({ field }) => (
                                <Select
                                    options={METRICS.map((m) => ({ key: m, value: m }))}
                                    value={field.value}
                                    onSelect={(opts) => field.onChange(opts?.[0]?.key ?? 'places_created')}
                                />
                            )}
                        />

                        <Controller
                            name={`rules.${idx}.value`}
                            control={control}
                            render={({ field }) => (
                                <Input
                                    type={'number'}
                                    value={String(field.value)}
                                    onChange={(e) => field.onChange(toNumber(e.target.value))}
                                    size={'medium'}
                                    className={styles.ruleValueInput}
                                />
                            )}
                        />

                        <Controller
                            name={`rules.${idx}.filter`}
                            control={control}
                            render={({ field }) => (
                                <Select
                                    options={categoryOptions}
                                    value={field.value?.category_id ?? ''}
                                    onSelect={(opts) => {
                                        const val = opts?.[0]?.key ?? ''
                                        field.onChange(val ? { category_id: val } : undefined)
                                    }}
                                    className={styles.ruleCategorySelect}
                                />
                            )}
                        />

                        <Button
                            mode={'secondary'}
                            variant={'negative'}
                            size={'medium'}
                            icon={'Close'}
                            tooltip={t('delete', { defaultValue: 'Удалить' })}
                            onClick={() => remove(idx)}
                        />
                    </div>
                ))}
                <Button
                    mode={'outline'}
                    size={'medium'}
                    icon={'PlusCircle'}
                    onClick={() => append({ metric: 'places_created', operator: '>=', value: 1 })}
                >
                    {t('achievements-admin-add-rule')}
                </Button>
            </div>

            <TextArea
                label={t('achievements-admin-rules-json')}
                value={rulesJson}
                readOnly
                rows={Math.min(rules.length * 6 + 2, 16)}
            />

            <div className={styles.formActions}>
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    link={'/admin/achievements'}
                >
                    {t('cancel')}
                </Button>
                <Button
                    mode={'primary'}
                    size={'medium'}
                    disabled={isLoading || isUploading}
                    onClick={() => void handleSubmit(onSubmit)()}
                >
                    {t('save')}
                </Button>
            </div>
        </div>
    )
}

export default AchievementForm
