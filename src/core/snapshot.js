export class Snapshot {
  /** @readonly */
  element = undefined

  constructor(element) {
    this.element = element
  }

  get activeElement() {
    return this.element.ownerDocument.activeElement
  }

  get children() {
    return [...this.element.children]
  }

  /** @param {string | undefined} anchor
   * @returns {boolean}
   */
  hasAnchor(anchor) {
    return this.getElementForAnchor(anchor) != null
  }

  /** @param {string | undefined} anchor
   * @returns {Element}
   */
  getElementForAnchor(anchor) {
    return anchor ? this.element.querySelector(`[id='${anchor}'], a[name='${anchor}']`) : null
  }

  get isConnected() {
    return this.element.isConnected
  }

  get firstAutofocusableElement() {
    const inertDisabledOrHidden = "[inert], :disabled, [hidden], details:not([open]), dialog:not([open])"

    for (const element of this.element.querySelectorAll("[autofocus]")) {
      if (element.closest(inertDisabledOrHidden) == null) return element
      else continue
    }

    return null
  }

  get permanentElements() {
    return queryPermanentElementsAll(this.element)
  }

  /** @param {string} id
   * @returns {Element}
   */
  getPermanentElementById(id) {
    return getPermanentElementById(this.element, id)
  }

  /** @param {Snapshot} snapshot
   * @returns {PermanentElementMap}
   */
  getPermanentElementMapForSnapshot(snapshot) {
    const permanentElementMap = {}

    for (const currentPermanentElement of this.permanentElements) {
      const { id } = currentPermanentElement
      const newPermanentElement = snapshot.getPermanentElementById(id)
      if (newPermanentElement) {
        permanentElementMap[id] = [currentPermanentElement, newPermanentElement]
      }
    }

    return permanentElementMap
  }
}

/** @param {ParentNode} node
 * @param {string} id
 * @returns {Element}
 */
export function getPermanentElementById(node, id) {
  return node.querySelector(`#${id}[data-turbo-permanent]`)
}

/** @param {ParentNode} node
 * @returns {NodeListOf<Element>}
 */
export function queryPermanentElementsAll(node) {
  return node.querySelectorAll("[id][data-turbo-permanent]")
}

/** @typedef {Record<string, [Element, Element]>} PermanentElementMap */
