export const equalsArrays = (array1?: string[], array2?: string[]): boolean =>
    (!array1?.length && !array2?.length) ||
    (!!array1?.length &&
        !!array2?.length &&
        array1.length === array2.length &&
        array1.every((item) => array2.includes(item)))
