import { StaticImageData } from 'next/image'

import { ApiModel } from '@/api'
import abandoned from '@/public/images/poi/abandoned.png'
import animals from '@/public/images/poi/animals.png'
import archeology from '@/public/images/poi/archeology.png'
import bridge from '@/public/images/poi/bridge.png'
import camping from '@/public/images/poi/camping.png'
import castle from '@/public/images/poi/castle.png'
import cave from '@/public/images/poi/cave.png'
import construction from '@/public/images/poi/construction.png'
import death from '@/public/images/poi/death.png'
import manor from '@/public/images/poi/manor.png'
import memorial from '@/public/images/poi/memorial.png'
import military from '@/public/images/poi/military.png'
import mine from '@/public/images/poi/mine.png'
import monument from '@/public/images/poi/monument.png'
import mountain from '@/public/images/poi/mountain.png'
import museum from '@/public/images/poi/museum.png'
import nature from '@/public/images/poi/nature.png'
import radiation from '@/public/images/poi/radiation.png'
import religious from '@/public/images/poi/religious.png'
import spring from '@/public/images/poi/spring.png'
import transport from '@/public/images/poi/transport.png'
import water from '@/public/images/poi/water.png'
import waterfall from '@/public/images/poi/waterfall.png'

export const categoryImage = (category?: ApiModel.Categories): StaticImageData => {
    switch (category) {
        case ApiModel.Categories.animals:
            return animals

        case ApiModel.Categories.death:
            return death

        case ApiModel.Categories.radiation:
            return radiation

        case ApiModel.Categories.bridge:
            return bridge

        case ApiModel.Categories.military:
            return military

        case ApiModel.Categories.transport:
            return transport

        case ApiModel.Categories.abandoned:
            return abandoned

        case ApiModel.Categories.mine:
            return mine

        case ApiModel.Categories.construction:
            return construction

        case ApiModel.Categories.memorial:
            return memorial

        case ApiModel.Categories.monument:
            return monument

        case ApiModel.Categories.museum:
            return museum

        case ApiModel.Categories.castle:
            return castle

        case ApiModel.Categories.manor:
            return manor

        case ApiModel.Categories.religious:
            return religious

        case ApiModel.Categories.archeology:
            return archeology

        case ApiModel.Categories.cave:
            return cave

        case ApiModel.Categories.waterfall:
            return waterfall

        case ApiModel.Categories.spring:
            return spring

        case ApiModel.Categories.nature:
            return nature

        case ApiModel.Categories.water:
            return water

        case ApiModel.Categories.mountain:
            return mountain

        case ApiModel.Categories.camping:
            return camping

        case undefined: {
            throw new Error('Not implemented yet: undefined case')
        }

        default:
            return nature
    }
}
