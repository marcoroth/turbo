import { FetchResponse } from "./fetch_response"
import { dispatch } from "../util"

export var FetchMethod
;(function (FetchMethod) {
  FetchMethod[(FetchMethod["get"] = 0)] = "get"
  FetchMethod[(FetchMethod["post"] = 1)] = "post"
  FetchMethod[(FetchMethod["put"] = 2)] = "put"
  FetchMethod[(FetchMethod["patch"] = 3)] = "patch"
  FetchMethod[(FetchMethod["delete"] = 4)] = "delete"
})(FetchMethod || (FetchMethod = {}))

/** @param {string} method
 * @returns {FetchMethod}
 */
export function fetchMethodFromString(method) {
  switch (method.toLowerCase()) {
    case "get":
      return FetchMethod.get
    case "post":
      return FetchMethod.post
    case "put":
      return FetchMethod.put
    case "patch":
      return FetchMethod.patch
    case "delete":
      return FetchMethod.delete
  }
}

export class FetchRequest {
  /** @readonly */
  delegate = undefined
  /** @readonly */
  method = undefined
  /** @readonly */
  headers = undefined
  /** @readonly */
  url = undefined
  /** @readonly */
  body = undefined
  /** @readonly */
  target = undefined
  /** @readonly
   * @default new AbortController()
   */
  abortController = new AbortController()
  /** @private
   * @default (_value: any) => {}
   */
  resolveRequestPromise = (_value) => {}

  constructor(delegate, method, location, body = new URLSearchParams(), target = null) {
    this.delegate = delegate
    this.method = method
    this.headers = this.defaultHeaders
    this.body = body
    this.url = location
    this.target = target
  }

  get location() {
    return this.url
  }

  get params() {
    return this.url.searchParams
  }

  get entries() {
    return this.body ? Array.from(this.body.entries()) : []
  }

  /** @returns {void} */
  cancel() {
    this.abortController.abort()
  }

  /** @returns {Promise<FetchResponse | void>} */
  async perform() {
    const { fetchOptions } = this
    this.delegate.prepareRequest(this)
    await this.allowRequestToBeIntercepted(fetchOptions)
    try {
      this.delegate.requestStarted(this)
      const response = await fetch(this.url.href, fetchOptions)
      return await this.receive(response)
    } catch (error) {
      if (error.name !== "AbortError") {
        if (this.willDelegateErrorHandling(error)) {
          this.delegate.requestErrored(this, error)
        }
        throw error
      }
    } finally {
      this.delegate.requestFinished(this)
    }
  }

  /** @param {Response} response
   * @returns {Promise<FetchResponse>}
   */
  async receive(response) {
    const fetchResponse = new FetchResponse(response)
    const event = dispatch("turbo:before-fetch-response", {
      cancelable: true,
      detail: { fetchResponse },
      target: this.target,
    })
    if (event.defaultPrevented) {
      this.delegate.requestPreventedHandlingResponse(this, fetchResponse)
    } else if (fetchResponse.succeeded) {
      this.delegate.requestSucceededWithResponse(this, fetchResponse)
    } else {
      this.delegate.requestFailedWithResponse(this, fetchResponse)
    }
    return fetchResponse
  }

  get fetchOptions() {
    return {
      method: FetchMethod[this.method].toUpperCase(),
      credentials: "same-origin",
      headers: this.headers,
      redirect: "follow",
      body: this.isSafe ? null : this.body,
      signal: this.abortSignal,
      referrer: this.delegate.referrer?.href,
    }
  }

  get defaultHeaders() {
    return {
      Accept: "text/html, application/xhtml+xml",
    }
  }

  get isSafe() {
    return this.method === FetchMethod.get
  }

  get abortSignal() {
    return this.abortController.signal
  }

  /** @param {string} mimeType
   * @returns {void}
   */
  acceptResponseType(mimeType) {
    this.headers["Accept"] = [mimeType, this.headers["Accept"]].join(", ")
  }

  /** @private
   * @param {RequestInit} fetchOptions
   * @returns {Promise<void>}
   */
  async allowRequestToBeIntercepted(fetchOptions) {
    const requestInterception = new Promise((resolve) => (this.resolveRequestPromise = resolve))
    const event = dispatch("turbo:before-fetch-request", {
      cancelable: true,
      detail: {
        fetchOptions,
        url: this.url,
        resume: this.resolveRequestPromise,
      },
      target: this.target,
    })
    if (event.defaultPrevented) await requestInterception
  }

  /** @private
   * @param {Error} error
   * @returns {boolean}
   */
  willDelegateErrorHandling(error) {
    const event = dispatch("turbo:fetch-request-error", {
      target: this.target,
      cancelable: true,
      detail: { request: this, error: error },
    })

    return !event.defaultPrevented
  }
}

/**
 * @typedef {CustomEvent<{
 *   fetchOptions: RequestInit
 *   url: URL
 *   resume: (value?: any) => void
 * }>} TurboBeforeFetchRequestEvent
 */
/**
 * @typedef {CustomEvent<{
 *   fetchResponse: FetchResponse
 * }>} TurboBeforeFetchResponseEvent
 */
/**
 * @typedef {CustomEvent<{
 *   request: FetchRequest
 *   error: Error
 * }>} TurboFetchRequestErrorEvent
 */
/** @typedef {FormData | URLSearchParams} FetchRequestBody */
/** @typedef {{ [header: string]: string }} FetchRequestHeaders */

/** @typedef {Object} FetchRequestDelegate
 * @property {URL} [referrer]
 */
/** @typedef {Object} FetchRequestOptions
 * @property {FetchRequestHeaders} headers
 * @property {FetchRequestBody} body
 * @property {boolean} followRedirects
 */
