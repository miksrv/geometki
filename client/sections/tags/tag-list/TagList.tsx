import React from 'react'
import { Container, ContainerProps } from 'simple-react-ui-kit'

import Link from 'next/link'

import { ApiModel } from '@/api'

import styles from './styles.module.sass'

interface TagsListProps extends Pick<ContainerProps, 'title'> {
    tags?: ApiModel.Tag[]
}

export const TagList: React.FC<TagsListProps> = ({ tags, ...props }) => (
    <Container
        {...props}
        className={styles.tagsList}
    >
        {tags?.map((tag) => (
            <Link
                key={`category${tag.title}`}
                href={`/places?tag=${tag.title}`}
                title={tag.title}
            >
                {tag.title} ({tag.count})
            </Link>
        ))}
    </Container>
)
