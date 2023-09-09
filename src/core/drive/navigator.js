import { getVisitAction } from "../../util"
import { FormSubmission } from "./form_submission"
import { expandURL, getAnchor, getRequestURL, locationIsVisitable } from "../url"
import { Visit } from "./visit"
import { PageSnapshot } from "./page_snapshot"

export class Navigator {
  /** @readonly */
  delegate = undefined
  /** */
  formSubmission = undefined
  /** */
  currentVisit = undefined

  constructor(delegate) {
    this.delegate = delegate
  }

  /** @param {URL} location
   * @param {Partial<VisitOptions>} [options={}]
   * @returns {void}
   */
  proposeVisit(location, options = {}) {
    if (this.delegate.allowsVisitingLocationWithAction(location, options.action)) {
      if (locationIsVisitable(location, this.view.snapshot.rootLocation)) {
        this.delegate.visitProposedToLocation(location, options)
      } else {
        window.location.href = location.toString()
      }
    }
  }

  /** @param {Locatable} locatable
   * @param {string} restorationIdentifier
   * @param {Partial<VisitOptions>} [options={}]
   * @returns {void}
   */
  startVisit(locatable, restorationIdentifier, options = {}) {
    this.stop()
    this.currentVisit = new Visit(this, expandURL(locatable), restorationIdentifier, {
      referrer: this.location,
      ...options,
    })
    this.currentVisit.start()
  }

  /** @param {HTMLFormElement} form
   * @param {HTMLElement} [submitter]
   * @returns {void}
   */
  submitForm(form, submitter) {
    this.stop()
    this.formSubmission = new FormSubmission(this, form, submitter, true)

    this.formSubmission.start()
  }

  /** @returns {void} */
  stop() {
    if (this.formSubmission) {
      this.formSubmission.stop()
      delete this.formSubmission
    }

    if (this.currentVisit) {
      this.currentVisit.cancel()
      delete this.currentVisit
    }
  }

  get adapter() {
    return this.delegate.adapter
  }

  get view() {
    return this.delegate.view
  }

  get history() {
    return this.delegate.history
  }

  // Form submission delegate

  /** @param {FormSubmission} formSubmission
   * @returns {void}
   */
  formSubmissionStarted(formSubmission) {
    // Not all adapters implement formSubmissionStarted
    if (typeof this.adapter.formSubmissionStarted === "function") {
      this.adapter.formSubmissionStarted(formSubmission)
    }
  }

  /** @param {FormSubmission} formSubmission
   * @param {FetchResponse} fetchResponse
   * @returns {Promise<void>}
   */
  async formSubmissionSucceededWithResponse(formSubmission, fetchResponse) {
    if (formSubmission == this.formSubmission) {
      const responseHTML = await fetchResponse.responseHTML
      if (responseHTML) {
        const shouldCacheSnapshot = formSubmission.isSafe
        if (!shouldCacheSnapshot) {
          this.view.clearSnapshotCache()
        }

        const { statusCode, redirected } = fetchResponse
        const action = this.getActionForFormSubmission(formSubmission)
        const visitOptions = {
          action,
          shouldCacheSnapshot,
          response: { statusCode, responseHTML, redirected },
        }
        this.proposeVisit(fetchResponse.location, visitOptions)
      }
    }
  }

  /** @param {FormSubmission} formSubmission
   * @param {FetchResponse} fetchResponse
   * @returns {Promise<void>}
   */
  async formSubmissionFailedWithResponse(formSubmission, fetchResponse) {
    const responseHTML = await fetchResponse.responseHTML

    if (responseHTML) {
      const snapshot = PageSnapshot.fromHTMLString(responseHTML)
      if (fetchResponse.serverError) {
        await this.view.renderError(snapshot, this.currentVisit)
      } else {
        await this.view.renderPage(snapshot, false, true, this.currentVisit)
      }
      this.view.scrollToTop()
      this.view.clearSnapshotCache()
    }
  }

  /** @param {FormSubmission} formSubmission
   * @param {Error} error
   * @returns {void}
   */
  formSubmissionErrored(formSubmission, error) {
    console.error(error)
  }

  /** @param {FormSubmission} formSubmission
   * @returns {void}
   */
  formSubmissionFinished(formSubmission) {
    // Not all adapters implement formSubmissionFinished
    if (typeof this.adapter.formSubmissionFinished === "function") {
      this.adapter.formSubmissionFinished(formSubmission)
    }
  }

  // Visit delegate

  /** @param {Visit} visit
   * @returns {void}
   */
  visitStarted(visit) {
    this.delegate.visitStarted(visit)
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitCompleted(visit) {
    this.delegate.visitCompleted(visit)
  }

  /** @param {URL} location
   * @param {Action} [action]
   * @returns {boolean}
   */
  locationWithActionIsSamePage(location, action) {
    const anchor = getAnchor(location)
    const currentAnchor = getAnchor(this.view.lastRenderedLocation)
    const isRestorationToTop = action === "restore" && typeof anchor === "undefined"

    return (
      action !== "replace" &&
      getRequestURL(location) === getRequestURL(this.view.lastRenderedLocation) &&
      (isRestorationToTop || (anchor != null && anchor !== currentAnchor))
    )
  }

  /** @param {URL} oldURL
   * @param {URL} newURL
   * @returns {void}
   */
  visitScrolledToSamePageLocation(oldURL, newURL) {
    this.delegate.visitScrolledToSamePageLocation(oldURL, newURL)
  }

  // Visits

  get location() {
    return this.history.location
  }

  get restorationIdentifier() {
    return this.history.restorationIdentifier
  }

  /** @param {FormSubmission}
   * @returns {Action}
   */
  getActionForFormSubmission({ submitter, formElement }) {
    return getVisitAction(submitter, formElement) || "advance"
  }
}

/**
 * @typedef {VisitDelegate & {
 *   allowsVisitingLocationWithAction(location: URL, action?: Action): boolean
 *   visitProposedToLocation(location: URL, options: Partial<VisitOptions>): void
 *   notifyApplicationAfterVisitingSamePageLocation(oldURL: URL, newURL: URL): void
 * }} NavigatorDelegate
 */
