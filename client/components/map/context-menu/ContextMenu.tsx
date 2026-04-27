import React, { useEffect, useRef, useState } from 'react'
import { Point } from 'leaflet'
import { Button, Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { useLeafletContext } from '@react-leaflet/core'

import { ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { MapLinks } from '@/components/shared'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'
import { convertDMS } from '@/utils/coordinates'
import { round } from '@/utils/helpers'

import { MapPositionType } from '../types'

import styles from './styles.module.sass'

export const ContextMenu: React.FC = () => {
    const { t } = useTranslation('components.interactive-map.context-menu')
    const dispatch = useAppDispatch()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [, setCoordinates] = useLocalStorage<MapPositionType>(LOCAL_STORAGE.MAP_CENTER)

    const getContext = useLeafletContext()
    const mapContext = useRef<ReturnType<typeof useLeafletContext>>(getContext)
    const mapSize = useRef<Point>(null)
    const menuWrapRef = useRef<HTMLDivElement>(null)

    const [pointCords, setPointCords] = useState<ApiType.Coordinates>()
    const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

    const [point, setPoint] = useState<{
        x: number
        y: number
    }>({
        x: 0,
        y: 0
    })

    const handleCopyCoordinates = async () => {
        await navigator.clipboard.writeText(`${pointCords?.lat} ${pointCords?.lon}`)
        setIsShowMenu(false)

        await dispatch(
            Notify({
                id: 'copyCoordinates',
                title: '',
                message: t('coordinates-copied', {
                    defaultValue: 'Координаты скопированы в буфер обмена'
                }),
                type: 'success'
            })
        )
    }

    useEffect(() => {
        if (mapContext.current.map) {
            mapSize.current = mapContext.current.map.getSize()

            mapContext.current.map.on('click dragstart zoom', () => {
                setIsShowMenu(false)
            })

            mapContext.current.map.on(
                'resize',
                (event) => {
                    mapSize.current = event.newSize
                },
                []
            )

            const menuPointYisOverFlow = (pointY: number, menuWrapHeight: number, mapSize: Point) => {
                if (pointY > mapSize.y - menuWrapHeight) {
                    return pointY - menuWrapHeight
                }
                return pointY
            }

            mapContext.current.map.on('contextmenu', (event) => {
                const pointRightClick: Point = event.containerPoint
                const menuWrapWidth: number = menuWrapRef.current ? Number(menuWrapRef.current.offsetWidth) : 0
                const menuWrapHeight: number = menuWrapRef.current ? Number(menuWrapRef.current.offsetHeight) : 0

                setPointCords({
                    lat: round(event.latlng.lat, 6) || 0,
                    lon: round(event.latlng.lng, 6) || 0
                })

                if (mapSize.current && pointRightClick.x > mapSize.current.x - menuWrapWidth) {
                    const calculationX =
                        pointRightClick.x === mapSize.current.x
                            ? pointRightClick.x - menuWrapWidth - 20
                            : pointRightClick.x - menuWrapWidth

                    setPoint({
                        x: calculationX,
                        y: menuPointYisOverFlow(pointRightClick.y, menuWrapHeight, mapSize.current)
                    })
                } else {
                    if (mapSize.current) {
                        setPoint({
                            x: pointRightClick.x,
                            y: menuPointYisOverFlow(pointRightClick.y, menuWrapHeight, mapSize.current)
                        })
                    }
                }

                setIsShowMenu(true)
            })
        }
    }, [])

    if (!getContext) {
        return null
    }

    return (
        <div
            ref={menuWrapRef}
            style={{
                display: isShowMenu ? 'block' : 'none',
                left: `${point.x}px`,
                position: 'absolute',
                top: `${point.y}px`,
                zIndex: 400
            }}
        >
            <Container className={styles.contextMenu}>
                <ul className={styles.menuList}>
                    <li className={styles.divider}>
                        <Button
                            mode={'link'}
                            size={'small'}
                            title={t('copy-to-clipboard', {
                                defaultValue: 'Скопировать в буфер обмена'
                            })}
                            onClick={handleCopyCoordinates}
                        >
                            {convertDMS(pointCords?.lat, pointCords?.lon)}
                        </Button>
                    </li>

                    {isAuth && (
                        <li className={styles.divider}>
                            <Link
                                href={'/places/create'}
                                title={t('create-geotag', {
                                    defaultValue: 'Создать геометку'
                                })}
                                onClick={() => {
                                    setCoordinates({
                                        lat: pointCords?.lat ?? 0,
                                        lon: pointCords?.lon ?? 0,
                                        zoom: 18
                                    })
                                }}
                            >
                                {t('create-geotag', { defaultValue: 'Создать геометку' })}
                            </Link>
                        </li>
                    )}

                    <MapLinks
                        showTitle={true}
                        asListItem={true}
                        lat={pointCords?.lat ?? 0}
                        lon={pointCords?.lon ?? 0}
                        zoom={mapContext.current.map.getZoom()}
                    />
                </ul>
            </Container>
        </div>
    )
}
