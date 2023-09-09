import { FetchResponse } from "../http/fetch_response"
import { StreamMessage } from "../core/streams/stream_message"

export class StreamObserver {
  /** @readonly */
  delegate = undefined
  /** @readonly
   * @default new Set()
   */
  sources = new Set()
  /** @private
   * @default false
   */
  started = false

  constructor(delegate) {
    this.delegate = delegate
  }

  /** @returns {void} */
  start() {
    if (!this.started) {
      this.started = true
      addEventListener("turbo:before-fetch-response", this.inspectFetchResponse, false)
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      this.started = false
      removeEventListener("turbo:before-fetch-response", this.inspectFetchResponse, false)
    }
  }

  /** @param {StreamSource} source
   * @returns {void}
   */
  connectStreamSource(source) {
    if (!this.streamSourceIsConnected(source)) {
      this.sources.add(source)
      source.addEventListener("message", this.receiveMessageEvent, false)
    }
  }

  /** @param {StreamSource} source
   * @returns {void}
   */
  disconnectStreamSource(source) {
    if (this.streamSourceIsConnected(source)) {
      this.sources.delete(source)
      source.removeEventListener("message", this.receiveMessageEvent, false)
    }
  }

  /** @param {StreamSource} source
   * @returns {boolean}
   */
  streamSourceIsConnected(source) {
    return this.sources.has(source)
  }

  /**
   * @default <EventListener>((event: TurboBeforeFetchResponseEvent) => {
   *     const response = fetchResponseFromEvent(event)
   *     if (response && fetchResponseIsStream(response)) {
   *       event.preventDefault()
   *       this.receiveMessageResponse(response)
   *     }
   *   })
   */
  inspectFetchResponse = (event) => {
    const response = fetchResponseFromEvent(event)
    if (response && fetchResponseIsStream(response)) {
      event.preventDefault()
      this.receiveMessageResponse(response)
    }
  }

  /**
   * @default (event: MessageEvent) => {
   *     if (this.started && typeof event.data == "string") {
   *       this.receiveMessageHTML(event.data)
   *     }
   *   }
   */
  receiveMessageEvent = (event) => {
    if (this.started && typeof event.data == "string") {
      this.receiveMessageHTML(event.data)
    }
  }

  /** @param {FetchResponse} response
   * @returns {Promise<void>}
   */
  async receiveMessageResponse(response) {
    const html = await response.responseHTML
    if (html) {
      this.receiveMessageHTML(html)
    }
  }

  /** @param {string} html
   * @returns {void}
   */
  receiveMessageHTML(html) {
    this.delegate.receivedMessageFromStream(StreamMessage.wrap(html))
  }
}

/** @param {TurboBeforeFetchResponseEvent} event
 * @returns {any}
 */
function fetchResponseFromEvent(event) {
  const fetchResponse = event.detail?.fetchResponse
  if (fetchResponse instanceof FetchResponse) {
    return fetchResponse
  }
}

/** @param {FetchResponse} response
 * @returns {any}
 */
function fetchResponseIsStream(response) {
  const contentType = response.contentType ?? ""
  return contentType.startsWith(StreamMessage.contentType)
}

/** @typedef {Object} StreamObserverDelegate */
