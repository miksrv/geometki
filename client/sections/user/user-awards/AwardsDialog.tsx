import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { AwardButton } from './AwardButton'
import { AwardDialog } from './AwardDialog'
import { AwardHoneycomb } from './AwardHoneycomb'
import { Award, UserAwardsData } from './useUserAwards'

import styles from './styles.module.sass'

/** Hexagons in a row of the whole set: large, the pictures are the point here */
const COLUMNS = 5

interface AwardsDialogProps {
    awards: UserAwardsData
    onClose: () => void
}

/**
 * Every award of a person, the separate page of the awards no more: one honeycomb without a
 * header and without groups — the earned ones (the seasons, the quests, the achievements), then
 * the permanent achievements not earned yet under a lock. A hexagon opens the award's card over this dialog: this
 * one is dimmed under it, and the backdrop and Escape close the card first.
 */
export const AwardsDialog: React.FC<AwardsDialogProps> = ({ awards, onClose }) => {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<Award>()

    // The kit's overlay keeps the handler it was made with: the latest state comes through refs
    const selectedRef = useRef<Award>(undefined)
    const onCloseRef = useRef(onClose)

    useEffect(() => {
        selectedRef.current = selected
        onCloseRef.current = onClose
    })

    const handleClose = useCallback(() => {
        if (selectedRef.current) {
            setSelected(undefined)
        } else {
            onCloseRef.current()
        }
    }, [])

    const label = t('user-side-awards')

    return (
        <>
            <Dialog
                open={true}
                // The same width is in `.dialogList`: the honeycomb measures it before the kit applies this
                maxWidth={'640px'}
                contentClassName={styles.dialogList}
                aria-label={label}
                data-dimmed={selected ? true : undefined}
                onCloseDialog={handleClose}
            >
                <button
                    type={'button'}
                    className={styles.dialogClose}
                    aria-label={t('close')}
                    onClick={onClose}
                >
                    <Icon name={'Close'} />
                </button>

                <AwardHoneycomb
                    columns={COLUMNS}
                    aria-label={label}
                    items={[...awards.earned, ...awards.locked].map((award) => ({
                        key: award.key,
                        node: (size) => (
                            <AwardButton
                                award={award}
                                size={size}
                                onOpen={setSelected}
                            />
                        )
                    }))}
                />
            </Dialog>

            {selected && (
                <AwardDialog
                    award={selected}
                    stacked={true}
                    onClose={() => setSelected(undefined)}
                />
            )}
        </>
    )
}
