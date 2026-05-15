import React, { useEffect, useRef, useState } from 'react'
import { Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet'
import Leaflet from 'leaflet'
import { Skeleton } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { APIWikipedia, RequestGetByBounds, WikipediaArticle, WikipediaGeoItem } from '@/api/apiWikipedia'

import { WIKIPEDIA_EXTRACT_MAX_CHARS } from './constants'
import { articleUrl, buildParams, createWikipediaIcon, extractArticle, truncateExtract } from './utils'

import styles from './styles.module.sass'

interface WikipediaProps {
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
}

export const Wikipedia: React.FC<WikipediaProps> = () => {
    const { i18n } = useTranslation()
    const locale = i18n.language

    const [params, setParams] = useState<RequestGetByBounds | null>(null)
    const [loadingArticleId, setLoadingArticleId] = useState<number | null>(null)
    const [selectedArticle, setSelectedArticle] = useState<WikipediaArticle | null>(null)
    const [selectedItem, setSelectedItem] = useState<WikipediaGeoItem | null>(null)
    const markerRefs = useRef<Record<number, Leaflet.Marker | null>>({})

    const map = useMapEvents({
        moveend: () => {
            setParams(buildParams(map.getBounds(), locale))
        }
    })

    useEffect(() => {
        setParams(buildParams(map.getBounds(), locale))
    }, [])

    useEffect(() => {
        if (loadingArticleId != null) {
            markerRefs.current[loadingArticleId]?.openPopup()
        }
    }, [loadingArticleId])

    const { data } = APIWikipedia.useGetByBoundsQuery(params!, { skip: !params })
    const [getExtract] = APIWikipedia.useLazyGetExtractQuery()

    const handleClose = () => {
        setSelectedItem(null)
        setSelectedArticle(null)
        setLoadingArticleId(null)
    }

    const handleMarkerClick = async (item: WikipediaGeoItem) => {
        setLoadingArticleId(item.pageid)
        setSelectedArticle(null)
        setSelectedItem(item)

        const result = await getExtract({ locale, pageid: item.pageid })

        if (result.data) {
            const article = extractArticle(result.data)
            if (article) {
                setSelectedArticle(article)
            }
        }

        setLoadingArticleId(null)
    }

    const items = data?.query?.geosearch ?? []

    if (!items.length) {
        return null
    }

    return (
        <>
            {items.map((item) => (
                <Marker
                    key={item.pageid}
                    ref={(ref) => {
                        markerRefs.current[item.pageid] = ref
                    }}
                    position={[item.lat, item.lon]}
                    icon={createWikipediaIcon(loadingArticleId === item.pageid)}
                    eventHandlers={{ click: () => handleMarkerClick(item) }}
                >
                    <Tooltip
                        direction={'top'}
                        offset={[0, -12]}
                    >
                        {item.title}
                    </Tooltip>
                    {selectedItem?.pageid === item.pageid && (
                        <Popup
                            className={styles.wikipediaPopup}
                            onClose={handleClose}
                        >
                            <div className={styles.content}>
                                {loadingArticleId != null ? (
                                    <>
                                        <Skeleton className={styles.skeletonImage} />
                                        <Skeleton className={styles.skeletonTitle} />
                                        <Skeleton className={styles.skeletonLine} />
                                        <Skeleton className={styles.skeletonLine} />
                                        <Skeleton className={styles.skeletonLineShort} />
                                    </>
                                ) : (
                                    selectedArticle && (
                                        <>
                                            {selectedArticle.thumbnail && (
                                                <img
                                                    className={styles.thumbnail}
                                                    src={selectedArticle.thumbnail.source}
                                                    alt={selectedArticle.title}
                                                />
                                            )}
                                            <h4 className={styles.title}>{selectedArticle.title}</h4>
                                            {selectedArticle.extract && (
                                                <p className={styles.extract}>
                                                    {truncateExtract(
                                                        selectedArticle.extract,
                                                        WIKIPEDIA_EXTRACT_MAX_CHARS
                                                    )}
                                                </p>
                                            )}
                                            <a
                                                className={styles.link}
                                                href={articleUrl(selectedArticle.title, locale)}
                                                target={'_blank'}
                                                rel={'noreferrer'}
                                            >
                                                {'Открыть на Wikipedia →'}
                                            </a>
                                        </>
                                    )
                                )}
                            </div>
                        </Popup>
                    )}
                </Marker>
            ))}
        </>
    )
}
