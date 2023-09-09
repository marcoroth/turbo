export {}

/** @typedef {"advance" | "replace" | "restore"} Action */
/** @typedef {{ x: number; y: number }} Position */
/**
 * @typedef {{
 *   addEventListener(
 *     type: "message",
 *     listener: (event: MessageEvent) => void,
 *     options?: boolean | AddEventListenerOptions
 *   ): void
 *   removeEventListener(
 *     type: "message",
 *     listener: (event: MessageEvent) => void,
 *     options?: boolean | EventListenerOptions
 *   ): void
 * }} StreamSource
 */
