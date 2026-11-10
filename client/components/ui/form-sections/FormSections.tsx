import React, { useEffect, useRef, useState } from 'react'
import { cn, Container, Icon, IconTypes } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

// The line under the app bar a card's top passes to become the current part; a menu click
// stops the card at 64px (`scroll-margin-top`)
const SPY_OFFSET = 80
// No scroll events for this long: a menu click's smooth scroll is over, ms
const SCROLL_IDLE = 150

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
    const keys = sections.map(({ key }) => key)

    const [active, setActive] = useState<string | undefined>(keys[0])

    // The part a menu click is scrolling to: the smooth scroll passes the parts between, and
    // the mark must not run through them
    const scrollTarget = useRef<string>(undefined)
    const release = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Scroll spy: the current part is the last card whose top has reached the line under the
    // app bar; at the end of the page — the last card, which may be too short to reach it.
    // The cards are looked up on each scroll, so they may appear after the menu (a skeleton)
    useEffect(() => {
        let frame = 0

        const update = () => {
            frame = 0

            // Scrolled to the very end of a page that scrolls at all
            const atEnd =
                window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
            const passed = keys.filter(
                (key) => (document.getElementById(key)?.getBoundingClientRect().top ?? Infinity) <= SPY_OFFSET
            )
            const current = atEnd ? keys[keys.length - 1] : (passed[passed.length - 1] ?? keys[0])

            if (scrollTarget.current) {
                // The click's scroll is over when it stops: no scroll events for a moment
                clearTimeout(release.current)
                release.current = setTimeout(() => {
                    scrollTarget.current = undefined
                    update()
                }, SCROLL_IDLE)

                return
            }

            if (current) {
                setActive(current)
            }
        }

        const onScroll = () => {
            if (!frame) {
                frame = requestAnimationFrame(update)
            }
        }

        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)

        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(release.current)
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
        }
    }, [keys.join()])

    // Scrolls without a history entry: the unsaved-changes guard reads Back from a `#part`
    // entry as leaving the page
    const handleClick = (key: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
        const target = document.getElementById(key)

        if (target) {
            event.preventDefault()
            scrollTarget.current = key
            // Let go even if the card is already in place and nothing scrolls
            clearTimeout(release.current)
            release.current = setTimeout(() => (scrollTarget.current = undefined), SCROLL_IDLE * 4)
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setActive(key)
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
