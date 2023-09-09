export class DOMTestCase {
  /** @default document.createElement("main") */
  fixtureElement = document.createElement("main")

  /** @returns {Promise<void>} */
  async setup() {
    this.fixtureElement.hidden = true
    document.body.insertAdjacentElement("afterbegin", this.fixtureElement)
  }

  /** @returns {Promise<void>} */
  async teardown() {
    this.fixtureElement.innerHTML = ""
    this.fixtureElement.remove()
  }

  /** @param {Node} node
   * @returns {void}
   */
  append(node) {
    this.fixtureElement.appendChild(node)
  }

  /** @param {string} selector
   * @returns {Element}
   */
  find(selector) {
    return this.fixtureElement.querySelector(selector)
  }

  get fixtureHTML() {
    return this.fixtureElement.innerHTML
  }

  set fixtureHTML(html) {
    this.fixtureElement.innerHTML = html
  }
}
