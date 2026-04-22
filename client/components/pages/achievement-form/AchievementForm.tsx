import React, { useMemo } from 'react'
import { Button, Input, Select, TextArea } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { API, ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'

import styles from './styles.module.sass'

type AchievementInput = ApiType.Achievements.AchievementInput
type AchievementRule = ApiType.Achievements.AchievementRule

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
    form: AchievementInput
    isLoading: boolean
    /** Current image URL — only passed from the edit page */
    imageUrl?: string | null
    /** Whether an image upload is in progress — only relevant when onImageUpload is provided */
    isUploading?: boolean
    onFieldChange: <K extends keyof AchievementInput>(key: K, value: AchievementInput[K]) => void
    onSubmit: () => void
    /** If provided, the image upload block is rendered */
    onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const AchievementForm: React.FC<AchievementFormProps> = ({
    form,
    isLoading,
    imageUrl,
    isUploading,
    onFieldChange,
    onSubmit,
    onImageUpload
}) => {
    const { t } = useTranslation()

    const { data: categoryData } = API.useCategoriesGetListQuery()
    const categoryOptions = useMemo(
        () => [
            { key: '', value: t('achievements-admin-filter-all') },
            ...(categoryData?.items?.map((item) => ({ key: item.name, value: item.title })) ?? [])
        ],
        [categoryData?.items, t]
    )

    const addRule = () => {
        onFieldChange('rules', [...form.rules, { metric: 'places_created', operator: '>=', value: 1 }])
    }

    const removeRule = (index: number) => {
        onFieldChange(
            'rules',
            form.rules.filter((_, i) => i !== index)
        )
    }

    const updateRule = (index: number, partial: Partial<AchievementRule>) => {
        onFieldChange(
            'rules',
            form.rules.map((r, i) => (i === index ? { ...r, ...partial } : r))
        )
    }

    const rulesJson = useMemo(() => JSON.stringify(form.rules, null, 2), [form.rules])

    return (
        <div className={styles.formGrid}>
            <Input
                label={t('achievements-admin-group-slug')}
                value={form.group_slug ?? ''}
                onChange={(e) => onFieldChange('group_slug', e.target.value)}
                placeholder={'explorer'}
                size={'medium'}
            />

            <div className={styles.formRow}>
                <Input
                    required={true}
                    label={`${t('achievements-admin-name')} 🇷🇺`}
                    value={form.title_ru}
                    onChange={(e) => onFieldChange('title_ru', e.target.value)}
                    size={'medium'}
                />
                <Input
                    required={true}
                    label={`${t('achievements-admin-name')} 🇬🇧`}
                    value={form.title_en}
                    onChange={(e) => onFieldChange('title_en', e.target.value)}
                    size={'medium'}
                />
            </div>

            <div className={styles.formRow}>
                <TextArea
                    label={`${t('description')} 🇷🇺`}
                    value={form.description_ru ?? ''}
                    onChange={(e) => onFieldChange('description_ru', e.target.value)}
                    rows={2}
                />
                <TextArea
                    label={`${t('description')} 🇬🇧`}
                    value={form.description_en ?? ''}
                    onChange={(e) => onFieldChange('description_en', e.target.value)}
                    rows={2}
                />
            </div>

            <div className={styles.formRow}>
                <Select
                    label={t('achievements-admin-category')}
                    options={CATEGORIES.map((c) => ({ key: c, value: t(`achievements-category-${c}`) }))}
                    value={form.category}
                    onSelect={(opts) =>
                        onFieldChange(
                            'category',
                            (opts?.[0]?.key ?? 'exploration') as ApiType.Achievements.AchievementCategory
                        )
                    }
                />

                <Select
                    label={t('achievements-admin-tier')}
                    options={TIERS.map((tier) => ({
                        key: tier,
                        value: t(`achievements-tier-${tier}`, { defaultValue: tier })
                    }))}
                    value={form.tier}
                    onSelect={(opts) =>
                        onFieldChange('tier', (opts?.[0]?.key ?? 'none') as ApiType.Achievements.AchievementTier)
                    }
                />

                <Select
                    label={t('achievements-admin-type')}
                    options={TYPES.map((type) => ({ key: type, value: t(`achievements-${type}`) }))}
                    value={form.type}
                    onSelect={(opts) =>
                        onFieldChange('type', (opts?.[0]?.key ?? 'base') as ApiType.Achievements.AchievementType)
                    }
                />
            </div>

            {form.type === 'seasonal' && (
                <div className={styles.formRow}>
                    <Input
                        label={t('achievements-admin-season-start')}
                        type={'date'}
                        value={form.season_start ?? ''}
                        onChange={(e) => onFieldChange('season_start', e.target.value || null)}
                        size={'medium'}
                    />
                    <Input
                        label={t('achievements-admin-season-end')}
                        type={'date'}
                        value={form.season_end ?? ''}
                        onChange={(e) => onFieldChange('season_end', e.target.value || null)}
                        size={'medium'}
                    />
                </div>
            )}

            <div className={styles.formRow}>
                <Input
                    label={t('achievements-admin-xp-bonus')}
                    type={'number'}
                    value={String(form.xp_bonus ?? 0)}
                    onChange={(e) => onFieldChange('xp_bonus', parseInt(e.target.value, 10) || 0)}
                    size={'medium'}
                />

                <Input
                    label={t('achievements-admin-sort-order')}
                    type={'number'}
                    value={String(form.sort_order ?? 0)}
                    onChange={(e) => onFieldChange('sort_order', parseInt(e.target.value, 10) || 0)}
                    size={'medium'}
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
                            onChange={onImageUpload}
                            disabled={isUploading}
                            style={{ flex: 1 }}
                        />
                        {imageUrl && (
                            <AchievementIcon
                                image={imageUrl}
                                size={36}
                            />
                        )}
                    </div>
                </div>
            )}

            <div className={styles.formField}>
                <label className={styles.label}>{t('achievements-admin-rules')}</label>
                {form.rules.map((rule, idx) => (
                    <div
                        key={idx}
                        className={styles.ruleRow}
                    >
                        <Select
                            options={METRICS.map((m) => ({ key: m, value: m }))}
                            value={rule.metric}
                            onSelect={(opts) => updateRule(idx, { metric: opts?.[0]?.key ?? 'places_created' })}
                        />

                        <Input
                            type={'number'}
                            value={String(rule.value)}
                            onChange={(e) => updateRule(idx, { value: parseInt(e.target.value, 10) || 0 })}
                            size={'medium'}
                            style={{ width: '70px' }}
                        />

                        <Select
                            options={categoryOptions}
                            value={rule.filter?.category_id ?? ''}
                            onSelect={(opts) => {
                                const val = opts?.[0]?.key ?? ''
                                updateRule(idx, { filter: val ? { category_id: val } : undefined })
                            }}
                            style={{ flex: 1 }}
                        />

                        <Button
                            mode={'secondary'}
                            variant={'negative'}
                            size={'medium'}
                            icon={'Close'}
                            onClick={() => removeRule(idx)}
                        />
                    </div>
                ))}
                <Button
                    mode={'outline'}
                    size={'medium'}
                    icon={'PlusCircle'}
                    onClick={addRule}
                >
                    {t('achievements-admin-add-rule')}
                </Button>
            </div>

            <TextArea
                label={t('achievements-admin-rules-json')}
                value={rulesJson}
                readOnly
                rows={Math.min(form.rules.length * 6 + 2, 16)}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
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
                    onClick={onSubmit}
                >
                    {t('save')}
                </Button>
            </div>
        </div>
    )
}

export default AchievementForm
