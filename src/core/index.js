import { Session } from "./session"
import { Cache } from "./cache"
import { PageRenderer } from "./drive/page_renderer"
import { PageSnapshot } from "./drive/page_snapshot"
import { FrameRenderer } from "./frames/frame_renderer"
import { FormSubmission } from "./drive/form_submission"

const session = new Session()
const cache = new Cache(session)
const { navigator } = session
export { navigator, session, cache, PageRenderer, PageSnapshot, FrameRenderer }

export { StreamActions } from "./streams/stream_actions"

/**
 * Starts the main session.
 * This initialises any necessary observers such as those to monitor
 * link interactions.
 * @returns {void}
 */
export function start() {
  session.start()
}

/**
 * Registers an adapter for the main session.
 * @param {Adapter} adapter Adapter to register
 * @returns {void}
 */
export function registerAdapter(adapter) {
  session.registerAdapter(adapter)
}

/**
 * Performs an application visit to the given location.
 * @param {Locatable} location Location to visit (a URL or path)
 * @param {Partial<VisitOptions>} [options] Options to apply
 * @returns {void}
 */
export function visit(location, options) {
  session.visit(location, options)
}

/**
 * Connects a stream source to the main session.
 * @param {StreamSource} source Stream source to connect
 * @returns {void}
 */
export function connectStreamSource(source) {
  session.connectStreamSource(source)
}

/**
 * Disconnects a stream source from the main session.
 * @param {StreamSource} source Stream source to disconnect
 * @returns {void}
 */
export function disconnectStreamSource(source) {
  session.disconnectStreamSource(source)
}

/**
 * Renders a stream message to the main session by appending it to the
 * current document.
 * @param {StreamMessage | string} message Message to render
 * @returns {void}
 */
export function renderStreamMessage(message) {
  session.renderStreamMessage(message)
}

/**
 * Removes all entries from the Turbo Drive page cache.
 * Call this when state has changed on the server that may affect cached pages.
 *
 * @deprecated since version 7.2.0 in favor of `Turbo.cache.clear()`
 * @returns {void}
 */
export function clearCache() {
  console.warn(
    "Please replace `Turbo.clearCache()` with `Turbo.cache.clear()`. The top-level function is deprecated and will be removed in a future version of Turbo.`"
  )
  session.clearCache()
}

/**
 * Sets the delay after which the progress bar will appear during navigation.
 *
 * The progress bar appears after 500ms by default.
 *
 * Note that this method has no effect when used with the iOS or Android
 * adapters.
 * @param {number} delay Time to delay in milliseconds
 * @returns {void}
 */
export function setProgressBarDelay(delay) {
  session.setProgressBarDelay(delay)
}

/** @param {(message: string, element: HTMLFormElement, submitter: HTMLElement | undefined) => Promise<boolean>} confirmMethod
 * @returns {void}
 */
export function setConfirmMethod(confirmMethod) {
  FormSubmission.confirmMethod = confirmMethod
}

/** @param {FormMode} mode
 * @returns {void}
 */
export function setFormMode(mode) {
  session.setFormMode(mode)
}
