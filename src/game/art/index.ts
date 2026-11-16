/**
 * All grafik ritas i kod, så spelet beror inte på några bildfiler. Resten av
 * spelet använder bara det som exporteras här; vill man byta till ett färdigt
 * tileset är det de här funktionerna som ska ersättas.
 */
export { TILE } from './grid';
export { bakeGround } from './ground';
export { bakeRows, OVER, PADX } from './objects';
export { portraitUrl, SPRITES } from './sprites';
