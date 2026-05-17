export enum Categories {
    animals = 'animals',
    bridge = 'bridge',
    radiation = 'radiation',
    death = 'death',
    military = 'military',
    transport = 'transport',
    abandoned = 'abandoned',
    mine = 'mine',
    construction = 'construction',
    memorial = 'memorial',
    monument = 'monument',
    museum = 'museum',
    castle = 'castle',
    manor = 'manor',
    religious = 'religious',
    archeology = 'archeology',
    cave = 'cave',
    waterfall = 'waterfall',
    spring = 'spring',
    nature = 'nature',
    water = 'water',
    mountain = 'mountain',
    camping = 'camping'
}

export type Category = {
    name: Categories
    title: string
    content?: string
    count?: number
}

export type TopCategory = Category & {
    cover?: {
        full?: string
        preview: string
    }
}
