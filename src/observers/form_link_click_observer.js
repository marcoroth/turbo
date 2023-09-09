import { LinkClickObserver } from "./link_click_observer"
import { getVisitAction } from "../util"

export class FormLinkClickObserver {
  /** @readonly */
  linkInterceptor = undefined
  /** @readonly */
  delegate = undefined

  constructor(delegate, element) {
    this.delegate = delegate
    this.linkInterceptor = new LinkClickObserver(this, element)
  }

  /** @returns {void} */
  start() {
    this.linkInterceptor.start()
  }

  /** @returns {void} */
  stop() {
    this.linkInterceptor.stop()
  }

  /** @param {Element} link
   * @param {URL} location
   * @param {MouseEvent} originalEvent
   * @returns {boolean}
   */
  willFollowLinkToLocation(link, location, originalEvent) {
    return (
      this.delegate.willSubmitFormLinkToLocation(link, location, originalEvent) &&
      link.hasAttribute("data-turbo-method")
    )
  }

  /** @param {Element} link
   * @param {URL} location
   * @returns {void}
   */
  followedLinkToLocation(link, location) {
    const form = document.createElement("form")

    const type = "hidden"
    for (const [name, value] of location.searchParams) {
      form.append(Object.assign(document.createElement("input"), { type, name, value }))
    }

    const action = Object.assign(location, { search: "" })
    form.setAttribute("data-turbo", "true")
    form.setAttribute("action", action.href)
    form.setAttribute("hidden", "")

    const method = link.getAttribute("data-turbo-method")
    if (method) form.setAttribute("method", method)

    const turboFrame = link.getAttribute("data-turbo-frame")
    if (turboFrame) form.setAttribute("data-turbo-frame", turboFrame)

    const turboAction = getVisitAction(link)
    if (turboAction) form.setAttribute("data-turbo-action", turboAction)

    const turboConfirm = link.getAttribute("data-turbo-confirm")
    if (turboConfirm) form.setAttribute("data-turbo-confirm", turboConfirm)

    const turboStream = link.hasAttribute("data-turbo-stream")
    if (turboStream) form.setAttribute("data-turbo-stream", "")

    this.delegate.submittedFormLinkToLocation(link, location, form)

    document.body.appendChild(form)
    form.addEventListener("turbo:submit-end", () => form.remove(), { once: true })
    requestAnimationFrame(() => form.requestSubmit())
  }
}

/**
 * @typedef {{
 *   willSubmitFormLinkToLocation(link: Element, location: URL, event: MouseEvent): boolean
 *   submittedFormLinkToLocation(link: Element, location: URL, form: HTMLFormElement): void
 * }} FormLinkClickObserverDelegate
 */
