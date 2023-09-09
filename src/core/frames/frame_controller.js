import { FrameElement, FrameLoadingStyle } from "../../elements/frame_element"
import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"
import { AppearanceObserver } from "../../observers/appearance_observer"
import {
  clearBusyState,
  dispatch,
  getAttribute,
  parseHTMLDocument,
  markAsBusy,
  uuid,
  getHistoryMethodForAction,
  getVisitAction,
} from "../../util"
import { FormSubmission } from "../drive/form_submission"
import { Snapshot } from "../snapshot"
import { getAction, expandURL, urlsAreEqual, locationIsVisitable } from "../url"
import { FormSubmitObserver } from "../../observers/form_submit_observer"
import { FrameView } from "./frame_view"
import { LinkInterceptor } from "./link_interceptor"
import { FormLinkClickObserver } from "../../observers/form_link_click_observer"
import { FrameRenderer } from "./frame_renderer"
import { session } from "../index"
import { StreamMessage } from "../streams/stream_message"
import { PageSnapshot } from "../drive/page_snapshot"
import { TurboFrameMissingError } from "../errors"

export class FrameController {
  /** @readonly */
  element = undefined
  /** @readonly */
  view = undefined
  /** @readonly */
  appearanceObserver = undefined
  /** @readonly */
  formLinkClickObserver = undefined
  /** @readonly */
  linkInterceptor = undefined
  /** @readonly */
  formSubmitObserver = undefined
  /** */
  formSubmission = undefined
  /** @default (_fetchResponse: FetchResponse) => {} */
  fetchResponseLoaded = (_fetchResponse) => {}
  /** @private
   * @default null
   */
  currentFetchRequest = null
  /** @private
   * @default () => {}
   */
  resolveVisitPromise = () => {}
  /** @private
   * @default false
   */
  connected = false
  /** @private
   * @default false
   */
  hasBeenLoaded = false
  /** @private
   * @default new Set()
   */
  ignoredAttributes = new Set()
  /** @private
   * @default null
   */
  action = null
  /** @readonly */
  restorationIdentifier = undefined
  /** @private */
  previousFrameElement = undefined
  /** @private */
  currentNavigationElement = undefined

  constructor(element) {
    this.element = element
    this.view = new FrameView(this, this.element)
    this.appearanceObserver = new AppearanceObserver(this, this.element)
    this.formLinkClickObserver = new FormLinkClickObserver(this, this.element)
    this.linkInterceptor = new LinkInterceptor(this, this.element)
    this.restorationIdentifier = uuid()
    this.formSubmitObserver = new FormSubmitObserver(this, this.element)
  }

  /** @returns {void} */
  connect() {
    if (!this.connected) {
      this.connected = true
      if (this.loadingStyle == FrameLoadingStyle.lazy) {
        this.appearanceObserver.start()
      } else {
        this.loadSourceURL()
      }
      this.formLinkClickObserver.start()
      this.linkInterceptor.start()
      this.formSubmitObserver.start()
    }
  }

  /** @returns {void} */
  disconnect() {
    if (this.connected) {
      this.connected = false
      this.appearanceObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkInterceptor.stop()
      this.formSubmitObserver.stop()
    }
  }

  /** @returns {void} */
  disabledChanged() {
    if (this.loadingStyle == FrameLoadingStyle.eager) {
      this.loadSourceURL()
    }
  }

  /** @returns {void} */
  sourceURLChanged() {
    if (this.isIgnoringChangesTo("src")) return

    if (this.element.isConnected) {
      this.complete = false
    }

    if (this.loadingStyle == FrameLoadingStyle.eager || this.hasBeenLoaded) {
      this.loadSourceURL()
    }
  }

  /** @returns {any} */
  sourceURLReloaded() {
    const { src } = this.element
    this.ignoringChangesToAttribute("complete", () => {
      this.element.removeAttribute("complete")
    })
    this.element.src = null
    this.element.src = src
    return this.element.loaded
  }

  /** @returns {void} */
  completeChanged() {
    if (this.isIgnoringChangesTo("complete")) return

    this.loadSourceURL()
  }

  /** @returns {void} */
  loadingStyleChanged() {
    if (this.loadingStyle == FrameLoadingStyle.lazy) {
      this.appearanceObserver.start()
    } else {
      this.appearanceObserver.stop()
      this.loadSourceURL()
    }
  }

  /** @private
   * @returns {Promise<void>}
   */
  async loadSourceURL() {
    if (this.enabled && this.isActive && !this.complete && this.sourceURL) {
      this.element.loaded = this.visit(expandURL(this.sourceURL))
      this.appearanceObserver.stop()
      await this.element.loaded
      this.hasBeenLoaded = true
    }
  }

  /** @param {FetchResponse} fetchResponse
   * @returns {Promise<void>}
   */
  async loadResponse(fetchResponse) {
    if (fetchResponse.redirected || (fetchResponse.succeeded && fetchResponse.isHTML)) {
      this.sourceURL = fetchResponse.response.url
    }

    try {
      const html = await fetchResponse.responseHTML
      if (html) {
        const document = parseHTMLDocument(html)
        const pageSnapshot = PageSnapshot.fromDocument(document)

        if (pageSnapshot.isVisitable) {
          await this.loadFrameResponse(fetchResponse, document)
        } else {
          await this.handleUnvisitableFrameResponse(fetchResponse)
        }
      }
    } finally {
      this.fetchResponseLoaded = () => {}
    }
  }

  // Appearance observer delegate

  /** @param {FrameElement} element
   * @returns {void}
   */
  elementAppearedInViewport(element) {
    this.proposeVisitIfNavigatedWithAction(element, element)
    this.loadSourceURL()
  }

  // Form link click observer delegate

  /** @param {Element} link
   * @returns {boolean}
   */
  willSubmitFormLinkToLocation(link) {
    return this.shouldInterceptNavigation(link)
  }

  /** @param {Element} link
   * @param {URL} _location
   * @param {HTMLFormElement} form
   * @returns {void}
   */
  submittedFormLinkToLocation(link, _location, form) {
    const frame = this.findFrameElement(link)
    if (frame) form.setAttribute("data-turbo-frame", frame.id)
  }

  // Link interceptor delegate

  /** @param {Element} element
   * @param {string} _location
   * @param {MouseEvent} _event
   * @returns {boolean}
   */
  shouldInterceptLinkClick(element, _location, _event) {
    return this.shouldInterceptNavigation(element)
  }

  /** @param {Element} element
   * @param {string} location
   * @returns {void}
   */
  linkClickIntercepted(element, location) {
    this.navigateFrame(element, location)
  }

  // Form submit observer delegate

  /** @param {HTMLFormElement} element
   * @param {HTMLElement} [submitter]
   * @returns {boolean}
   */
  willSubmitForm(element, submitter) {
    return element.closest("turbo-frame") == this.element && this.shouldInterceptNavigation(element, submitter)
  }

  /** @param {HTMLFormElement} element
   * @param {HTMLElement} [submitter]
   * @returns {void}
   */
  formSubmitted(element, submitter) {
    if (this.formSubmission) {
      this.formSubmission.stop()
    }

    this.formSubmission = new FormSubmission(this, element, submitter)
    const { fetchRequest } = this.formSubmission
    this.prepareRequest(fetchRequest)
    this.formSubmission.start()
  }

  // Fetch request delegate

  /** @param {FetchRequest} request
   * @returns {void}
   */
  prepareRequest(request) {
    request.headers["Turbo-Frame"] = this.id

    if (this.currentNavigationElement?.hasAttribute("data-turbo-stream")) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  /** @param {FetchRequest} _request
   * @returns {void}
   */
  requestStarted(_request) {
    markAsBusy(this.element)
  }

  /** @param {FetchRequest} _request
   * @param {FetchResponse} _response
   * @returns {void}
   */
  requestPreventedHandlingResponse(_request, _response) {
    this.resolveVisitPromise()
  }

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {Promise<void>}
   */
  async requestSucceededWithResponse(request, response) {
    await this.loadResponse(response)
    this.resolveVisitPromise()
  }

  /** @param {FetchRequest} request
   * @param {FetchResponse} response
   * @returns {Promise<void>}
   */
  async requestFailedWithResponse(request, response) {
    await this.loadResponse(response)
    this.resolveVisitPromise()
  }

  /** @param {FetchRequest} request
   * @param {Error} error
   * @returns {void}
   */
  requestErrored(request, error) {
    console.error(error)
    this.resolveVisitPromise()
  }

  /** @param {FetchRequest} _request
   * @returns {void}
   */
  requestFinished(_request) {
    clearBusyState(this.element)
  }

  // Form submission delegate

  /** @param {FormSubmission}
   * @returns {void}
   */
  formSubmissionStarted({ formElement }) {
    markAsBusy(formElement, this.findFrameElement(formElement))
  }

  /** @param {FormSubmission} formSubmission
   * @param {FetchResponse} response
   * @returns {void}
   */
  formSubmissionSucceededWithResponse(formSubmission, response) {
    const frame = this.findFrameElement(formSubmission.formElement, formSubmission.submitter)

    frame.delegate.proposeVisitIfNavigatedWithAction(frame, formSubmission.formElement, formSubmission.submitter)
    frame.delegate.loadResponse(response)

    if (!formSubmission.isSafe) {
      session.clearCache()
    }
  }

  /** @param {FormSubmission} formSubmission
   * @param {FetchResponse} fetchResponse
   * @returns {void}
   */
  formSubmissionFailedWithResponse(formSubmission, fetchResponse) {
    this.element.delegate.loadResponse(fetchResponse)
    session.clearCache()
  }

  /** @param {FormSubmission} formSubmission
   * @param {Error} error
   * @returns {void}
   */
  formSubmissionErrored(formSubmission, error) {
    console.error(error)
  }

  /** @param {FormSubmission}
   * @returns {void}
   */
  formSubmissionFinished({ formElement }) {
    clearBusyState(formElement, this.findFrameElement(formElement))
  }

  // View delegate

  /** @param {Snapshot<FrameElement>}
   * @param {boolean} _isPreview
   * @param {ViewRenderOptions<FrameElement>} options
   * @returns {boolean}
   */
  allowsImmediateRender({ element: newFrame }, _isPreview, options) {
    const event = dispatch("turbo:before-frame-render", {
      target: this.element,
      detail: { newFrame, ...options },
      cancelable: true,
    })
    const {
      defaultPrevented,
      detail: { render },
    } = event

    if (this.view.renderer && render) {
      this.view.renderer.renderElement = render
    }

    return !defaultPrevented
  }

  /** @param {Snapshot} _snapshot
   * @param {boolean} _isPreview
   * @returns {void}
   */
  viewRenderedSnapshot(_snapshot, _isPreview) {}

  /** @param {Element} element
   * @returns {void}
   */
  preloadOnLoadLinksForView(element) {
    session.preloadOnLoadLinksForView(element)
  }

  /** @returns {void} */
  viewInvalidated() {}

  // Frame renderer delegate
  /** @param {FrameElement} currentElement
   * @param {FrameElement} _newElement
   * @returns {void}
   */
  willRenderFrame(currentElement, _newElement) {
    this.previousFrameElement = currentElement.cloneNode(true)
  }

  /**
   * @default ({ element }: Snapshot) => {
   *     const frame = element.querySelector("#" + this.element.id)
   * // TS-TO-JSDOC BLANK LINE //
   *     if (frame && this.previousFrameElement) {
   *       frame.replaceChildren(...this.previousFrameElement.children)
   *     }
   * // TS-TO-JSDOC BLANK LINE //
   *     delete this.previousFrameElement
   *   }
   */
  visitCachedSnapshot = ({ element }) => {
    const frame = element.querySelector("#" + this.element.id)

    if (frame && this.previousFrameElement) {
      frame.replaceChildren(...this.previousFrameElement.children)
    }

    delete this.previousFrameElement
  }

  // Private

  /** @private
   * @param {FetchResponse} fetchResponse
   * @param {Document} document
   * @returns {Promise<void>}
   */
  async loadFrameResponse(fetchResponse, document) {
    const newFrameElement = await this.extractForeignFrameElement(document.body)

    if (newFrameElement) {
      const snapshot = new Snapshot(newFrameElement)
      const renderer = new FrameRenderer(this, this.view.snapshot, snapshot, FrameRenderer.renderElement, false, false)
      if (this.view.renderPromise) await this.view.renderPromise
      this.changeHistory()

      await this.view.render(renderer)
      this.complete = true
      session.frameRendered(fetchResponse, this.element)
      session.frameLoaded(this.element)
      this.fetchResponseLoaded(fetchResponse)
    } else if (this.willHandleFrameMissingFromResponse(fetchResponse)) {
      this.handleFrameMissingFromResponse(fetchResponse)
    }
  }

  /** @private
   * @param {URL} url
   * @returns {Promise<void>}
   */
  async visit(url) {
    const request = new FetchRequest(this, FetchMethod.get, url, new URLSearchParams(), this.element)

    this.currentFetchRequest?.cancel()
    this.currentFetchRequest = request

    return new Promise((resolve) => {
      this.resolveVisitPromise = () => {
        this.resolveVisitPromise = () => {}
        this.currentFetchRequest = null
        resolve()
      }
      request.perform()
    })
  }

  /** @private
   * @param {Element} element
   * @param {string} url
   * @param {HTMLElement} [submitter]
   * @returns {void}
   */
  navigateFrame(element, url, submitter) {
    const frame = this.findFrameElement(element, submitter)

    frame.delegate.proposeVisitIfNavigatedWithAction(frame, element, submitter)

    this.withCurrentNavigationElement(element, () => {
      frame.src = url
    })
  }

  /** @param {FrameElement} frame
   * @param {Element} element
   * @param {HTMLElement} [submitter]
   * @returns {void}
   */
  proposeVisitIfNavigatedWithAction(frame, element, submitter) {
    this.action = getVisitAction(submitter, element, frame)

    if (this.action) {
      const pageSnapshot = PageSnapshot.fromElement(frame).clone()
      const { visitCachedSnapshot } = frame.delegate

      frame.delegate.fetchResponseLoaded = (fetchResponse) => {
        if (frame.src) {
          const { statusCode, redirected } = fetchResponse
          const responseHTML = frame.ownerDocument.documentElement.outerHTML
          const response = { statusCode, redirected, responseHTML }
          const options = {
            response,
            visitCachedSnapshot,
            willRender: false,
            updateHistory: false,
            restorationIdentifier: this.restorationIdentifier,
            snapshot: pageSnapshot,
          }

          if (this.action) options.action = this.action

          session.visit(frame.src, options)
        }
      }
    }
  }

  /** @returns {void} */
  changeHistory() {
    if (this.action) {
      const method = getHistoryMethodForAction(this.action)
      session.history.update(method, expandURL(this.element.src || ""), this.restorationIdentifier)
    }
  }

  /** @private
   * @param {FetchResponse} fetchResponse
   * @returns {Promise<void>}
   */
  async handleUnvisitableFrameResponse(fetchResponse) {
    console.warn(
      `The response (${fetchResponse.statusCode}) from <turbo-frame id="${this.element.id}"> is performing a full page visit due to turbo-visit-control.`
    )

    await this.visitResponse(fetchResponse.response)
  }

  /** @private
   * @param {FetchResponse} fetchResponse
   * @returns {boolean}
   */
  willHandleFrameMissingFromResponse(fetchResponse) {
    this.element.setAttribute("complete", "")

    const response = fetchResponse.response
    const visit = async (url, options = {}) => {
      if (url instanceof Response) {
        this.visitResponse(url)
      } else {
        session.visit(url, options)
      }
    }

    const event = dispatch("turbo:frame-missing", {
      target: this.element,
      detail: { response, visit },
      cancelable: true,
    })

    return !event.defaultPrevented
  }

  /** @private
   * @param {FetchResponse} fetchResponse
   * @returns {void}
   */
  handleFrameMissingFromResponse(fetchResponse) {
    this.view.missing()
    this.throwFrameMissingError(fetchResponse)
  }

  /** @private
   * @param {FetchResponse} fetchResponse
   * @returns {void}
   */
  throwFrameMissingError(fetchResponse) {
    const message = `The response (${fetchResponse.statusCode}) did not contain the expected <turbo-frame id="${this.element.id}"> and will be ignored. To perform a full page visit instead, set turbo-visit-control to reload.`
    throw new TurboFrameMissingError(message)
  }

  /** @private
   * @param {Response} response
   * @returns {Promise<void>}
   */
  async visitResponse(response) {
    const wrapped = new FetchResponse(response)
    const responseHTML = await wrapped.responseHTML
    const { location, redirected, statusCode } = wrapped

    return session.visit(location, { response: { redirected, statusCode, responseHTML } })
  }

  /** @private
   * @param {Element} element
   * @param {HTMLElement} [submitter]
   * @returns {any}
   */
  findFrameElement(element, submitter) {
    const id = getAttribute("data-turbo-frame", submitter, element) || this.element.getAttribute("target")
    return getFrameElementById(id) ?? this.element
  }

  /** @param {ParentNode} container
   * @returns {Promise<FrameElement | null>}
   */
  async extractForeignFrameElement(container) {
    let element
    const id = CSS.escape(this.id)

    try {
      element = activateElement(container.querySelector(`turbo-frame#${id}`), this.sourceURL)
      if (element) {
        return element
      }

      element = activateElement(container.querySelector(`turbo-frame[src][recurse~=${id}]`), this.sourceURL)
      if (element) {
        await element.loaded
        return await this.extractForeignFrameElement(element)
      }
    } catch (error) {
      console.error(error)
      return new FrameElement()
    }

    return null
  }

  /** @private
   * @param {HTMLFormElement} form
   * @param {HTMLElement} [submitter]
   * @returns {any}
   */
  formActionIsVisitable(form, submitter) {
    const action = getAction(form, submitter)

    return locationIsVisitable(expandURL(action), this.rootLocation)
  }

  /** @private
   * @param {Element} element
   * @param {HTMLElement} [submitter]
   * @returns {boolean}
   */
  shouldInterceptNavigation(element, submitter) {
    const id = getAttribute("data-turbo-frame", submitter, element) || this.element.getAttribute("target")

    if (element instanceof HTMLFormElement && !this.formActionIsVisitable(element, submitter)) {
      return false
    }

    if (!this.enabled || id == "_top") {
      return false
    }

    if (id) {
      const frameElement = getFrameElementById(id)
      if (frameElement) {
        return !frameElement.disabled
      }
    }

    if (!session.elementIsNavigatable(element)) {
      return false
    }

    if (submitter && !session.elementIsNavigatable(submitter)) {
      return false
    }

    return true
  }

  // Computed properties

  get id() {
    return this.element.id
  }

  get enabled() {
    return !this.element.disabled
  }

  get sourceURL() {
    if (this.element.src) {
      return this.element.src
    }
  }

  set sourceURL(sourceURL) {
    this.ignoringChangesToAttribute("src", () => {
      this.element.src = sourceURL ?? null
    })
  }

  get loadingStyle() {
    return this.element.loading
  }

  get isLoading() {
    return this.formSubmission !== undefined || this.resolveVisitPromise() !== undefined
  }

  get complete() {
    return this.element.hasAttribute("complete")
  }

  set complete(value) {
    this.ignoringChangesToAttribute("complete", () => {
      if (value) {
        this.element.setAttribute("complete", "")
      } else {
        this.element.removeAttribute("complete")
      }
    })
  }

  get isActive() {
    return this.element.isActive && this.connected
  }

  get rootLocation() {
    const meta = this.element.ownerDocument.querySelector(`meta[name="turbo-root"]`)
    const root = meta?.content ?? "/"
    return expandURL(root)
  }

  /** @private
   * @param {FrameElementObservedAttribute} attributeName
   * @returns {boolean}
   */
  isIgnoringChangesTo(attributeName) {
    return this.ignoredAttributes.has(attributeName)
  }

  /** @private
   * @param {FrameElementObservedAttribute} attributeName
   * @param {() => void} callback
   * @returns {void}
   */
  ignoringChangesToAttribute(attributeName, callback) {
    this.ignoredAttributes.add(attributeName)
    callback()
    this.ignoredAttributes.delete(attributeName)
  }

  /** @private
   * @param {Element} element
   * @param {() => void} callback
   * @returns {void}
   */
  withCurrentNavigationElement(element, callback) {
    this.currentNavigationElement = element
    callback()
    delete this.currentNavigationElement
  }
}

/** @param {string | null} id
 * @returns {HTMLElement}
 */
function getFrameElementById(id) {
  if (id != null) {
    const element = document.getElementById(id)
    if (element instanceof FrameElement) {
      return element
    }
  }
}

/** @param {Element | null} element
 * @param {string | null} [currentURL]
 * @returns {Element}
 */
function activateElement(element, currentURL) {
  if (element) {
    const src = element.getAttribute("src")
    if (src != null && currentURL != null && urlsAreEqual(src, currentURL)) {
      throw new Error(`Matching <turbo-frame id="${element.id}"> element has a source URL which references itself`)
    }
    if (element.ownerDocument !== document) {
      element = document.importNode(element, true)
    }

    if (element instanceof FrameElement) {
      element.connectedCallback()
      element.disconnectedCallback()
      return element
    }
  }
}

/** @typedef {(location: Response | Locatable, options: Partial<VisitOptions>) => Promise<void>} VisitFallback */
/** @typedef {CustomEvent<{ response: Response; visit: VisitFallback }>} TurboFrameMissingEvent */
