export type UserLevel = {
    level?: number
    experience?: number
    /** Experience the current level starts at */
    levelExperience?: number
    /** Experience the next level starts at; null on the last level */
    nextLevel?: number | null
}
