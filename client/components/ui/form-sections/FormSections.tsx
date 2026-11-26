import React from 'react'
import { cn, Container, Icon, IconTypes } from 'simple-react-ui-kit'

import { useScrollSpy } from '@/hooks/useScrollSpy'

import styles from './styles.module.sass'

export interface FormSectionsItem {
    /** The id of the part's `FormSection` */
    key: string
    title: string
    icon: IconTypes
}

export interface FormSectionsProps {
    /** The parts in their page order; a part left out has no menu row */
    sections: FormSectionsItem[]
    /** The menu's accessible name, "Разделы настроек" */
    label: string
    /** The cards (`FormSection`), the messages above them, `FormActions` at the end */
    children?: React.ReactNode
}

/**
 * A page form in parts (DESIGN.md → Patterns → Page forms in parts): a sticky vertical menu of
 * the parts on the left of desktop, the cards on the rest of the width; phones get the cards
 * alone on the full width. A click scrolls to the card, the mark follows the scroll.
 */
export const FormSections: React.FC<FormSectionsProps> = ({ sections, label, children }) => (
    <div className={styles.layout}>
        <FormSectionsMenu
            sections={sections}
            label={label}
        />

        <div className={styles.content}>{children}</div>
    </div>
)

export interface FormSectionProps {
    /** The anchor of the menu row */
    id?: string
    title?: string
    /** What goes in the part, a secondary line under the title */
    description?: string
    className?: string
    children?: React.ReactNode
}

/** A part of a page form: a titled card, what goes in it in a line under the title */
export const FormSection: React.FC<FormSectionProps> = ({ id, title, description, className, children }) => (
    <Container
        id={id}
        className={cn(styles.section, className)}
        title={title}
    >
        {description && <p className={styles.description}>{description}</p>}
        {children}
    </Container>
)

const FormSectionsMenu: React.FC<Omit<FormSectionsProps, 'children'>> = ({ sections, label }) => {
    const { active, scrollTo } = useScrollSpy(sections.map(({ key }) => key))

    // Scrolls without a history entry: the unsaved-changes guard reads Back from a `#part`
    // entry as leaving the page
    const handleClick = (key: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (scrollTo(key)) {
            event.preventDefault()
        }
    }

    return (
        <nav
            className={styles.menu}
            aria-label={label}
        >
            <ul>
                {sections.map(({ key, icon, title }) => (
                    <li key={key}>
                        <a
                            href={`#${key}`}
                            className={cn(active === key && styles.active)}
                            aria-current={active === key ? 'location' : undefined}
                            onClick={handleClick(key)}
                        >
                            <Icon name={icon} />
                            {title}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
