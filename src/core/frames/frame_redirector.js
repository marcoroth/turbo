import { FormSubmitObserver } from "../../observers/form_submit_observer"
import { FrameElement } from "../../elements/frame_element"
import { LinkInterceptor } from "./link_interceptor"
import { expandURL, getAction, locationIsVisitable } from "../url"

export class FrameRedirector {
  /** @readonly */
  session = undefined
  /** @readonly */
  element = undefined
  /** @readonly */
  linkInterceptor = undefined
  /** @readonly */
  formSubmitObserver = undefined

  constructor(session, element) {
    this.session = session
    this.element = element
    this.linkInterceptor = new LinkInterceptor(this, element)
    this.formSubmitObserver = new FormSubmitObserver(this, element)
  }

  /** @returns {void} */
  start() {
    this.linkInterceptor.start()
    this.formSubmitObserver.start()
  }

  /** @returns {void} */
  stop() {
    this.linkInterceptor.stop()
    this.formSubmitObserver.stop()
  }

  /** @param {Element} element
   * @param {string} _location
   * @param {MouseEvent} _event
   * @returns {boolean}
   */
  shouldInterceptLinkClick(element, _location, _event) {
    return this.shouldRedirect(element)
  }

  /** @param {Element} element
   * @param {string} url
   * @param {MouseEvent} event
   * @returns {void}
   */
  linkClickIntercepted(element, url, event) {
    const frame = this.findFrameElement(element)
    if (frame) {
      frame.delegate.linkClickIntercepted(element, url, event)
    }
  }

  /** @param {HTMLFormElement} element
   * @param {HTMLElement} [submitter]
   * @returns {boolean}
   */
  willSubmitForm(element, submitter) {
    return (
      element.closest("turbo-frame") == null &&
      this.shouldSubmit(element, submitter) &&
      this.shouldRedirect(element, submitter)
    )
  }

  /** @param {HTMLFormElement} element
   * @param {HTMLElement} [submitter]
   * @returns {void}
   */
  formSubmitted(element, submitter) {
    const frame = this.findFrameElement(element, submitter)
    if (frame) {
      frame.delegate.formSubmitted(element, submitter)
    }
  }

  /** @private
   * @param {HTMLFormElement} form
   * @param {HTMLElement} [submitter]
   * @returns {any}
   */
  shouldSubmit(form, submitter) {
    const action = getAction(form, submitter)
    const meta = this.element.ownerDocument.querySelector(`meta[name="turbo-root"]`)
    const rootLocation = expandURL(meta?.content ?? "/")

    return this.shouldRedirect(form, submitter) && locationIsVisitable(action, rootLocation)
  }

  /** @private
   * @param {Element} element
   * @param {HTMLElement} [submitter]
   * @returns {boolean}
   */
  shouldRedirect(element, submitter) {
    const isNavigatable =
      element instanceof HTMLFormElement
        ? this.session.submissionIsNavigatable(element, submitter)
        : this.session.elementIsNavigatable(element)

    if (isNavigatable) {
      const frame = this.findFrameElement(element, submitter)
      return frame ? frame != element.closest("turbo-frame") : false
    } else {
      return false
    }
  }

  /** @private
   * @param {Element} element
   * @param {HTMLElement} [submitter]
   * @returns {Element}
   */
  findFrameElement(element, submitter) {
    const id = submitter?.getAttribute("data-turbo-frame") || element.getAttribute("data-turbo-frame")
    if (id && id != "_top") {
      const frame = this.element.querySelector(`#${id}:not([disabled])`)
      if (frame instanceof FrameElement) {
        return frame
      }
    }
  }
}
