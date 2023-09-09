export class Bardo {
  /** @readonly */
  permanentElementMap = undefined
  /** @readonly */
  delegate = undefined

  /** @static
   * @param {BardoDelegate} delegate
   * @param {PermanentElementMap} permanentElementMap
   * @param {() => void} callback
   * @returns {Promise<void>}
   */
  static async preservingPermanentElements(delegate, permanentElementMap, callback) {
    const bardo = new this(delegate, permanentElementMap)
    bardo.enter()
    await callback()
    bardo.leave()
  }

  constructor(delegate, permanentElementMap) {
    this.delegate = delegate
    this.permanentElementMap = permanentElementMap
  }

  /** @returns {void} */
  enter() {
    for (const id in this.permanentElementMap) {
      const [currentPermanentElement, newPermanentElement] = this.permanentElementMap[id]
      this.delegate.enteringBardo(currentPermanentElement, newPermanentElement)
      this.replaceNewPermanentElementWithPlaceholder(newPermanentElement)
    }
  }

  /** @returns {void} */
  leave() {
    for (const id in this.permanentElementMap) {
      const [currentPermanentElement] = this.permanentElementMap[id]
      this.replaceCurrentPermanentElementWithClone(currentPermanentElement)
      this.replacePlaceholderWithPermanentElement(currentPermanentElement)
      this.delegate.leavingBardo(currentPermanentElement)
    }
  }

  /** @param {Element} permanentElement
   * @returns {void}
   */
  replaceNewPermanentElementWithPlaceholder(permanentElement) {
    const placeholder = createPlaceholderForPermanentElement(permanentElement)
    permanentElement.replaceWith(placeholder)
  }

  /** @param {Element} permanentElement
   * @returns {void}
   */
  replaceCurrentPermanentElementWithClone(permanentElement) {
    const clone = permanentElement.cloneNode(true)
    permanentElement.replaceWith(clone)
  }

  /** @param {Element} permanentElement
   * @returns {void}
   */
  replacePlaceholderWithPermanentElement(permanentElement) {
    const placeholder = this.getPlaceholderById(permanentElement.id)
    placeholder?.replaceWith(permanentElement)
  }

  /** @param {string} id
   * @returns {HTMLMetaElement}
   */
  getPlaceholderById(id) {
    return this.placeholders.find((element) => element.content == id)
  }

  get placeholders() {
    return [...document.querySelectorAll("meta[name=turbo-permanent-placeholder][content]")]
  }
}

/** @param {Element} permanentElement
 * @returns {HTMLMetaElement}
 */
function createPlaceholderForPermanentElement(permanentElement) {
  const element = document.createElement("meta")
  element.setAttribute("name", "turbo-permanent-placeholder")
  element.setAttribute("content", permanentElement.id)
  return element
}

/** @typedef {Object} BardoDelegate */
