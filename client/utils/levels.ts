import { StaticImageData } from 'next/image'

import rank1 from '@/public/images/levels/rank_1.png'
import rank2 from '@/public/images/levels/rank_2.png'
import rank3 from '@/public/images/levels/rank_3.png'
import rank4 from '@/public/images/levels/rank_4.png'
import rank5 from '@/public/images/levels/rank_5.png'
import rank6 from '@/public/images/levels/rank_6.png'
import rank7 from '@/public/images/levels/rank_7.png'
import rank8 from '@/public/images/levels/rank_8.png'
import rank9 from '@/public/images/levels/rank_9.png'
import rank10 from '@/public/images/levels/rank_10.png'
import rank11 from '@/public/images/levels/rank_11.png'
import rank12 from '@/public/images/levels/rank_12.png'
import rank13 from '@/public/images/levels/rank_13.png'
import rank14 from '@/public/images/levels/rank_14.png'
import rank15 from '@/public/images/levels/rank_15.png'
import rank16 from '@/public/images/levels/rank_16.png'
import rank17 from '@/public/images/levels/rank_17.png'
import rank18 from '@/public/images/levels/rank_18.png'
import rank19 from '@/public/images/levels/rank_19.png'
import rank20 from '@/public/images/levels/rank_20.png'
import rank21 from '@/public/images/levels/rank_21.png'
import rank22 from '@/public/images/levels/rank_22.png'
import rank23 from '@/public/images/levels/rank_23.png'
import rank24 from '@/public/images/levels/rank_24.png'
import rank25 from '@/public/images/levels/rank_25.png'
import rank26 from '@/public/images/levels/rank_26.png'
import rank27 from '@/public/images/levels/rank_27.png'
import rank28 from '@/public/images/levels/rank_28.png'
import rank29 from '@/public/images/levels/rank_29.png'
import rank30 from '@/public/images/levels/rank_30.png'

export const levelImage = (level?: number): StaticImageData => {
    switch (level) {
        case 1:
            return rank1
        case 2:
            return rank2
        case 3:
            return rank3
        case 4:
            return rank4
        case 5:
            return rank5
        case 6:
            return rank6
        case 7:
            return rank7
        case 8:
            return rank8
        case 9:
            return rank9
        case 10:
            return rank10
        case 11:
            return rank11
        case 12:
            return rank12
        case 13:
            return rank13
        case 14:
            return rank14
        case 15:
            return rank15
        case 16:
            return rank16
        case 17:
            return rank17
        case 18:
            return rank18
        case 19:
            return rank19
        case 20:
            return rank20
        case 21:
            return rank21
        case 22:
            return rank22
        case 23:
            return rank23
        case 24:
            return rank24
        case 25:
            return rank25
        case 26:
            return rank26
        case 27:
            return rank27
        case 28:
            return rank28
        case 29:
            return rank29
        case 30:
            return rank30

        case undefined:
        default:
            return rank1
    }
}

export const nextLevelPercentage = (currentExperience: number, experienceToNextLevel: number): number => {
    if (currentExperience < 0 || experienceToNextLevel <= 0) {
        return 0
    }

    return Math.min(100, (currentExperience / experienceToNextLevel) * 100)
}
