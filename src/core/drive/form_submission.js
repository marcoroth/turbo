import { FetchRequest, FetchMethod, fetchMethodFromString } from "../../http/fetch_request"
import { expandURL } from "../url"
import { dispatch, getAttribute, getMetaContent, hasAttribute } from "../../util"
import { StreamMessage } from "../streams/stream_message"

export var FormSubmissionState
;(function (FormSubmissionState) {
  FormSubmissionState[(FormSubmissionState["initialized"] = 0)] = "initialized"
  FormSubmissionState[(FormSubmissionState["requesting"] = 1)] = "requesting"
  FormSubmissionState[(FormSubmissionState["waiting"] = 2)] = "waiting"
  FormSubmissionState[(FormSubmissionState["receiving"] = 3)] = "receiving"
  FormSubmissionState[(FormSubmissionState["stopping"] = 4)] = "stopping"
  FormSubmissionState[(FormSubmissionState["stopped"] = 5)] = "stopped"
})(FormSubmissionState || (FormSubmissionState = {}))

var FormEnctype
;(function (FormEnctype) {
  FormEnctype["urlEncoded"] = "application/x-www-form-urlencoded"
  FormEnctype["multipart"] = "multipart/form-data"
  FormEnctype["plain"] = "text/plain"
})(FormEnctype || (FormEnctype = {}))

/** @param {string} encoding
 * @returns {FormEnctype}
 */
function formEnctypeFromString(encoding) {
  switch (encoding.toLowerCase()) {
    case FormEnctype.multipart:
      return FormEnctype.multipart
    case FormEnctype.plain:
      return FormEnctype.plain
    default:
      return FormEnctype.urlEncoded
  }
}

export class FormSubmission {
  /** @readonly */
  delegate = undefined
  /** @readonly */
  formElement = undefined
  /** @readonly */
  submitter = undefined
  /** @readonly */
  formData = undefined
  /** @readonly */
  location = undefined
  /** @readonly */
  fetchRequest = undefined
  /** @readonly */
  mustRedirect = undefined
  /** @default FormSubmissionState.initialized */
  state = FormSubmissionState.initialized
  /** */
  result = undefined
  /** */
  originalSubmitText = undefined

  /** @static
   * @param {string} message
   * @param {HTMLFormElement} _element
   * @param {HTMLElement | undefined} _submitter
   * @returns {Promise<boolean>}
   */
  static confirmMethod(message, _element, _submitter) {
    return Promise.resolve(confirm(message))
  }

  constructor(delegate, formElement, submitter, mustRedirect = false) {
    this.delegate = delegate
    this.formElement = formElement
    this.submitter = submitter
    this.formData = buildFormData(formElement, submitter)
    this.location = expandURL(this.action)
    if (this.method == FetchMethod.get) {
      mergeFormDataEntries(this.location, [...this.body.entries()])
    }
    this.fetchRequest = new FetchRequest(this, this.method, this.location, this.body, this.formElement)
    this.mustRedirect = mustRedirect
  }

  get method() {
    const method = this.submitter?.getAttribute("formmethod") || this.formElement.getAttribute("method") || ""
    return fetchMethodFromString(method.toLowerCase()) || FetchMethod.get
  }

  get action() {
    const formElementAction = typeof this.formElement.action === "string" ? this.formElement.action : null

    if (this.submitter?.hasAttribute("formaction")) {
      return this.submitter.getAttribute("formaction") || ""
    } else {
      return this.formElement.getAttribute("action") || formElementAction || ""
    }
  }

  get body() {
    if (this.enctype == FormEnctype.urlEncoded || this.method == FetchMethod.get) {
      return new URLSearchParams(this.stringFormData)
    } else {
      return this.formData
    }
  }

  get enctype() {
    return formEnctypeFromString(this.submitter?.getAttribute("formenctype") || this.formElement.enctype)
  }

  get isSafe() {
    return this.fetchRequest.isSafe
  }

  get stringFormData() {
    return [...this.formData].reduce((entries, [name, value]) => {
      return entries.concat(typeof value == "string" ? [[name, value]] : [])
    }, [])
  }

  // The submission process

  /** @returns {Promise<any>} */
  async start() {
    const { initialized, requesting } = FormSubmissionState
    const confirmationMessage = getAttribute("data-turbo-confirm", this.submitter, this.formElement)

    if (typeof confirmationMessage === "string") {
      const answer = await FormSubmission.confirmMethod(confirmationMessage, this.formElement, this.submitter)
      if (!answer) {
        return
      }
    }

    if (this.state == initialized) {
      this.state = requesting
      return this.fetchRequest.perform()
    }
  }

  /** @returns {boolean} */
  stop() {
    const { stopping, stopped } = FormSubmissionState
    if (this.state != stopping && this.state != stopped) {
      this.state = stopping
      this.fetchRequest.cancel()
      return true
    }
  }

  // Fetch request delegate

  /** @param {FetchRequest} request
   * @returns {void}
   */
  prepareRequest(request) {
    if (!request.isSafe) {
      const token = getCookieValue(getMetaContent("csrf-param")) || getMetaContent("csrf-token")
      if (token) {
        request.headers["X-CSRF-Token"] = token
      }
    }

    if (this.requestAcceptsTurboStreamResponse(request)) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  /** @param {FetchRequest} _request
   * @returns {void}
   */
  requestStarted(_request) {
    this.state = FormSubmissionState.waiting
    this.submitter?.setAttribute("disabled", "")
    this.setSubmitsWith()
    dispatch("turbo:submit-start", {
      target: this.formElement,
      detail: { formSubmission: this },
    })
    this.delegate.formSubmissionStarted(this)
  }

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {void}
   */
  requestPreventedHandlingResponse(request, response) {
    this.result = { success: response.succeeded, fetchResponse: response }
  }

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {void}
   */
  requestSucceededWithResponse(request, response) {
    if (response.clientError || response.serverError) {
      this.delegate.formSubmissionFailedWithResponse(this, response)
    } else if (this.requestMustRedirect(request) && responseSucceededWithoutRedirect(response)) {
      const error = new Error("Form responses must redirect to another location")
      this.delegate.formSubmissionErrored(this, error)
    } else {
      this.state = FormSubmissionState.receiving
      this.result = { success: true, fetchResponse: response }
      this.delegate.formSubmissionSucceededWithResponse(this, response)
    }
  }

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {void}
   */
  requestFailedWithResponse(request, response) {
    this.result = { success: false, fetchResponse: response }
    this.delegate.formSubmissionFailedWithResponse(this, response)
  }

  /** @param {FetchRequest} request
   * @param {Error} error
   * @returns {void}
   */
  requestErrored(request, error) {
    this.result = { success: false, error }
    this.delegate.formSubmissionErrored(this, error)
  }

  /** @param {FetchRequest} _request
   * @returns {void}
   */
  requestFinished(_request) {
    this.state = FormSubmissionState.stopped
    this.submitter?.removeAttribute("disabled")
    this.resetSubmitterText()
    dispatch("turbo:submit-end", {
      target: this.formElement,
      detail: { formSubmission: this, ...this.result },
    })
    this.delegate.formSubmissionFinished(this)
  }

  // Private

  /** @returns {void} */
  setSubmitsWith() {
    if (!this.submitter || !this.submitsWith) return

    if (this.submitter.matches("button")) {
      this.originalSubmitText = this.submitter.innerHTML
      this.submitter.innerHTML = this.submitsWith
    } else if (this.submitter.matches("input")) {
      const input = this.submitter
      this.originalSubmitText = input.value
      input.value = this.submitsWith
    }
  }

  /** @returns {void} */
  resetSubmitterText() {
    if (!this.submitter || !this.originalSubmitText) return

    if (this.submitter.matches("button")) {
      this.submitter.innerHTML = this.originalSubmitText
    } else if (this.submitter.matches("input")) {
      const input = this.submitter
      input.value = this.originalSubmitText
    }
  }

  /** @param {FetchRequest} request
   * @returns {boolean}
   */
  requestMustRedirect(request) {
    return !request.isSafe && this.mustRedirect
  }

  /** @param {FetchRequest} request
   * @returns {any}
   */
  requestAcceptsTurboStreamResponse(request) {
    return !request.isSafe || hasAttribute("data-turbo-stream", this.submitter, this.formElement)
  }

  get submitsWith() {
    return this.submitter?.getAttribute("data-turbo-submits-with")
  }
}

/** @param {HTMLFormElement} formElement
 * @param {HTMLElement} [submitter]
 * @returns {FormData}
 */
function buildFormData(formElement, submitter) {
  const formData = new FormData(formElement)
  const name = submitter?.getAttribute("name")
  const value = submitter?.getAttribute("value")

  if (name) {
    formData.append(name, value || "")
  }

  return formData
}

/** @param {string | null} cookieName
 * @returns {string}
 */
function getCookieValue(cookieName) {
  if (cookieName != null) {
    const cookies = document.cookie ? document.cookie.split("; ") : []
    const cookie = cookies.find((cookie) => cookie.startsWith(cookieName))
    if (cookie) {
      const value = cookie.split("=").slice(1).join("=")
      return value ? decodeURIComponent(value) : undefined
    }
  }
}

/** @param {FetchResponse} response
 * @returns {boolean}
 */
function responseSucceededWithoutRedirect(response) {
  return response.statusCode == 200 && !response.redirected
}

/** @param {URL} url
 * @param {[string, FormDataEntryValue][]} entries
 * @returns {URL}
 */
function mergeFormDataEntries(url, entries) {
  const searchParams = new URLSearchParams()

  for (const [name, value] of entries) {
    if (value instanceof File) continue

    searchParams.append(name, value)
  }

  url.search = searchParams.toString()

  return url
}

/** @typedef {{ success: boolean; fetchResponse: FetchResponse } | { success: false; error: Error }} FormSubmissionResult */
/** @typedef {CustomEvent<{ formSubmission: FormSubmission }>} TurboSubmitStartEvent */
/**
 * @typedef {CustomEvent<
 *   { formSubmission: FormSubmission } & { [K in keyof FormSubmissionResult]?: FormSubmissionResult[K] }
 * >} TurboSubmitEndEvent
 */

/** @typedef {Object} FormSubmissionDelegate */
