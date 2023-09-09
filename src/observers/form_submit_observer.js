export class FormSubmitObserver {
  /** @readonly */
  delegate = undefined
  /** @readonly */
  eventTarget = undefined
  /** @default false */
  started = false

  constructor(delegate, eventTarget) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  /** @returns {void} */
  start() {
    if (!this.started) {
      this.eventTarget.addEventListener("submit", this.submitCaptured, true)
      this.started = true
    }
  }

  /** @returns {void} */
  stop() {
    if (this.started) {
      this.eventTarget.removeEventListener("submit", this.submitCaptured, true)
      this.started = false
    }
  }

  /**
   * @default () => {
   *     this.eventTarget.removeEventListener("submit", this.submitBubbled, false)
   *     this.eventTarget.addEventListener("submit", this.submitBubbled, false)
   *   }
   */
  submitCaptured = () => {
    this.eventTarget.removeEventListener("submit", this.submitBubbled, false)
    this.eventTarget.addEventListener("submit", this.submitBubbled, false)
  }

  /**
   * @default <EventListener>((event: SubmitEvent) => {
   *     if (!event.defaultPrevented) {
   *       const form = event.target instanceof HTMLFormElement ? event.target : undefined
   *       const submitter = event.submitter || undefined
   * // TS-TO-JSDOC BLANK LINE //
   *       if (
   *         form &&
   *         submissionDoesNotDismissDialog(form, submitter) &&
   *         submissionDoesNotTargetIFrame(form, submitter) &&
   *         this.delegate.willSubmitForm(form, submitter)
   *       ) {
   *         event.preventDefault()
   *         event.stopImmediatePropagation()
   *         this.delegate.formSubmitted(form, submitter)
   *       }
   *     }
   *   })
   */
  submitBubbled = (event) => {
    if (!event.defaultPrevented) {
      const form = event.target instanceof HTMLFormElement ? event.target : undefined
      const submitter = event.submitter || undefined

      if (
        form &&
        submissionDoesNotDismissDialog(form, submitter) &&
        submissionDoesNotTargetIFrame(form, submitter) &&
        this.delegate.willSubmitForm(form, submitter)
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.delegate.formSubmitted(form, submitter)
      }
    }
  }
}

/** @param {HTMLFormElement} form
 * @param {HTMLElement} [submitter]
 * @returns {boolean}
 */
function submissionDoesNotDismissDialog(form, submitter) {
  const method = submitter?.getAttribute("formmethod") || form.getAttribute("method")

  return method != "dialog"
}

/** @param {HTMLFormElement} form
 * @param {HTMLElement} [submitter]
 * @returns {boolean}
 */
function submissionDoesNotTargetIFrame(form, submitter) {
  if (submitter?.hasAttribute("formtarget") || form.hasAttribute("target")) {
    const target = submitter?.getAttribute("formtarget") || form.target

    for (const element of document.getElementsByName(target)) {
      if (element instanceof HTMLIFrameElement) return false
    }

    return true
  } else {
    return true
  }
}

/** @typedef {Object} FormSubmitObserverDelegate */
