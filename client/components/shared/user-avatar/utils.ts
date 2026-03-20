import { SizeType } from './types'

export const getDimension = (size?: SizeType) => (size === 'medium' ? 36 : size === 'tiny' ? 32 : 20)
