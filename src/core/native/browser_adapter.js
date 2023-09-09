import { ProgressBar } from "../drive/progress_bar"
import { SystemStatusCode } from "../drive/visit"
import { uuid, dispatch } from "../../util"

export class BrowserAdapter {
  /** @readonly */
  session = undefined
  /** @readonly
   * @default new ProgressBar()
   */
  progressBar = new ProgressBar()

  /** */
  visitProgressBarTimeout = undefined
  /** */
  formProgressBarTimeout = undefined
  /** */
  location = undefined

  constructor(session) {
    this.session = session
  }

  /** @param {URL} location
   * @param {Partial<VisitOptions>} [options]
   * @returns {void}
   */
  visitProposedToLocation(location, options) {
    this.navigator.startVisit(location, options?.restorationIdentifier || uuid(), options)
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitStarted(visit) {
    this.location = visit.location
    visit.loadCachedSnapshot()
    visit.issueRequest()
    visit.goToSamePageAnchor()
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitRequestStarted(visit) {
    this.progressBar.setValue(0)
    if (visit.hasCachedSnapshot() || visit.action != "restore") {
      this.showVisitProgressBarAfterDelay()
    } else {
      this.showProgressBar()
    }
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitRequestCompleted(visit) {
    visit.loadResponse()
  }

  /** @param {Visit} visit
   * @param {number} statusCode
   * @returns {any}
   */
  visitRequestFailedWithStatusCode(visit, statusCode) {
    switch (statusCode) {
      case SystemStatusCode.networkFailure:
      case SystemStatusCode.timeoutFailure:
      case SystemStatusCode.contentTypeMismatch:
        return this.reload({
          reason: "request_failed",
          context: {
            statusCode,
          },
        })
      default:
        return visit.loadResponse()
    }
  }

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitRequestFinished(_visit) {
    this.progressBar.setValue(1)
    this.hideVisitProgressBar()
  }

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitCompleted(_visit) {}

  /** @param {ReloadReason} reason
   * @returns {void}
   */
  pageInvalidated(reason) {
    this.reload(reason)
  }

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitFailed(_visit) {}

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitRendered(_visit) {}

  /** @param {FormSubmission} _formSubmission
   * @returns {void}
   */
  formSubmissionStarted(_formSubmission) {
    this.progressBar.setValue(0)
    this.showFormProgressBarAfterDelay()
  }

  /** @param {FormSubmission} _formSubmission
   * @returns {void}
   */
  formSubmissionFinished(_formSubmission) {
    this.progressBar.setValue(1)
    this.hideFormProgressBar()
  }

  // Private

  /** @returns {void} */
  showVisitProgressBarAfterDelay() {
    this.visitProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
  }

  /** @returns {void} */
  hideVisitProgressBar() {
    this.progressBar.hide()
    if (this.visitProgressBarTimeout != null) {
      window.clearTimeout(this.visitProgressBarTimeout)
      delete this.visitProgressBarTimeout
    }
  }

  /** @returns {void} */
  showFormProgressBarAfterDelay() {
    if (this.formProgressBarTimeout == null) {
      this.formProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
    }
  }

  /** @returns {void} */
  hideFormProgressBar() {
    this.progressBar.hide()
    if (this.formProgressBarTimeout != null) {
      window.clearTimeout(this.formProgressBarTimeout)
      delete this.formProgressBarTimeout
    }
  }

  /**
   * @default () => {
   *     this.progressBar.show()
   *   }
   */
  showProgressBar = () => {
    this.progressBar.show()
  }

  /** @param {ReloadReason} reason
   * @returns {void}
   */
  reload(reason) {
    dispatch("turbo:reload", { detail: reason })

    window.location.href = this.location?.toString() || window.location.href
  }

  get navigator() {
    return this.session.navigator
  }
}

/** @typedef {StructuredReason | undefined} ReloadReason */

/** @typedef {Object} StructuredReason
 * @property {string} reason
 * @property {{[key:string]:any}} [context]
 */
