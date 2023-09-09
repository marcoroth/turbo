import * as Turbo from "../../index"
import { assert } from "@open-wc/testing"

class DeprecatedAdapterSupportTest {
  /** @default [] */
  locations = []
  // Adapter interface
  /** @param {URL} location
   * @param {Partial<VisitOptions>} [_options]
   * @returns {void}
   */
  visitProposedToLocation(location, _options) {
    this.locations.push(location)
  }

  /** @param {Visit} visit
   * @returns {void}
   */
  visitStarted(visit) {
    this.locations.push(visit.location)
    visit.cancel()
  }

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitCompleted(_visit) {}

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitFailed(_visit) {}

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitRequestStarted(_visit) {}

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitRequestCompleted(_visit) {}

  /** @param {Visit} _visit
   * @param {number} _statusCode
   * @returns {void}
   */
  visitRequestFailedWithStatusCode(_visit, _statusCode) {}

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitRequestFinished(_visit) {}

  /** @param {Visit} _visit
   * @returns {void}
   */
  visitRendered(_visit) {}

  /** @param {FormSubmission} _formSubmission
   * @returns {void}
   */
  formSubmissionStarted(_formSubmission) {}

  /** @param {FormSubmission} _formSubmission
   * @returns {void}
   */
  formSubmissionFinished(_formSubmission) {}

  /** @returns {void} */
  pageInvalidated() {}
}

let adapter

setup(() => {
  adapter = new DeprecatedAdapterSupportTest()
  Turbo.registerAdapter(adapter)
})

test("test visit proposal location includes deprecated absoluteURL property", async () => {
  Turbo.navigator.proposeVisit(new URL(window.location.toString()))
  assert.equal(adapter.locations.length, 1)

  const [location] = adapter.locations
  assert.equal(location.toString(), location.absoluteURL)
})

test("test visit start location includes deprecated absoluteURL property", async () => {
  Turbo.navigator.startVisit(window.location.toString(), "123")
  assert.equal(adapter.locations.length, 1)

  const [location] = adapter.locations
  assert.equal(location.toString(), location.absoluteURL)
})
