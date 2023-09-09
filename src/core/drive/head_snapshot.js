import { Snapshot } from "../snapshot"

/** @extends Snapshot<HTMLHeadElement> */
export class HeadSnapshot extends Snapshot {
  /** @readonly
   * @default this.children
   *     .filter((element) => !elementIsNoscript(element))
   *     .map((element) => elementWithoutNonce(element))
   *     .reduce((result, element) => {
   *       const { outerHTML } = element
   *       const details: ElementDetails =
   *         outerHTML in result
   *           ? result[outerHTML]
   *           : {
   *               type: elementType(element),
   *               tracked: elementIsTracked(element),
   *               elements: [],
   *             }
   *       return {
   *         ...result,
   *         [outerHTML]: {
   *           ...details,
   *           elements: [...details.elements, element],
   *         },
   *       }
   *     }, {} as ElementDetailMap)
   */
  detailsByOuterHTML = this.children
    .filter((element) => !elementIsNoscript(element))
    .map((element) => elementWithoutNonce(element))
    .reduce((result, element) => {
      const { outerHTML } = element
      const details =
        outerHTML in result
          ? result[outerHTML]
          : {
              type: elementType(element),
              tracked: elementIsTracked(element),
              elements: [],
            }
      return {
        ...result,
        [outerHTML]: {
          ...details,
          elements: [...details.elements, element],
        },
      }
    }, {})

  get trackedElementSignature() {
    return Object.keys(this.detailsByOuterHTML)
      .filter((outerHTML) => this.detailsByOuterHTML[outerHTML].tracked)
      .join("")
  }

  /** @param {HeadSnapshot} snapshot
   * @returns {HTMLScriptElement[]}
   */
  getScriptElementsNotInSnapshot(snapshot) {
    return this.getElementsMatchingTypeNotInSnapshot("script", snapshot)
  }

  /** @param {HeadSnapshot} snapshot
   * @returns {HTMLLinkElement[]}
   */
  getStylesheetElementsNotInSnapshot(snapshot) {
    return this.getElementsMatchingTypeNotInSnapshot("stylesheet", snapshot)
  }

  /** @param {ElementType} matchedType
   * @param {HeadSnapshot} snapshot
   * @returns {T[]}
   */
  getElementsMatchingTypeNotInSnapshot(matchedType, snapshot) {
    return Object.keys(this.detailsByOuterHTML)
      .filter((outerHTML) => !(outerHTML in snapshot.detailsByOuterHTML))
      .map((outerHTML) => this.detailsByOuterHTML[outerHTML])
      .filter(({ type }) => type == matchedType)
      .map(({ elements: [element] }) => element)
  }

  get provisionalElements() {
    return Object.keys(this.detailsByOuterHTML).reduce((result, outerHTML) => {
      const { type, tracked, elements } = this.detailsByOuterHTML[outerHTML]
      if (type == null && !tracked) {
        return [...result, ...elements]
      } else if (elements.length > 1) {
        return [...result, ...elements.slice(1)]
      } else {
        return result
      }
    }, [])
  }

  /** @param {string} name
   * @returns {string | null}
   */
  getMetaValue(name) {
    const element = this.findMetaElementByName(name)
    return element ? element.getAttribute("content") : null
  }

  /** @param {string} name
   * @returns {any}
   */
  findMetaElementByName(name) {
    return Object.keys(this.detailsByOuterHTML).reduce((result, outerHTML) => {
      const {
        elements: [element],
      } = this.detailsByOuterHTML[outerHTML]
      return elementIsMetaElementWithName(element, name) ? element : result
    }, undefined)
  }
}

/** @param {Element} element
 * @returns {"script" | "stylesheet"}
 */
function elementType(element) {
  if (elementIsScript(element)) {
    return "script"
  } else if (elementIsStylesheet(element)) {
    return "stylesheet"
  }
}

/** @param {Element} element
 * @returns {boolean}
 */
function elementIsTracked(element) {
  return element.getAttribute("data-turbo-track") == "reload"
}

/** @param {Element} element
 * @returns {boolean}
 */
function elementIsScript(element) {
  const tagName = element.localName
  return tagName == "script"
}

/** @param {Element} element
 * @returns {boolean}
 */
function elementIsNoscript(element) {
  const tagName = element.localName
  return tagName == "noscript"
}

/** @param {Element} element
 * @returns {boolean}
 */
function elementIsStylesheet(element) {
  const tagName = element.localName
  return tagName == "style" || (tagName == "link" && element.getAttribute("rel") == "stylesheet")
}

/** @param {Element} element
 * @param {string} name
 * @returns {boolean}
 */
function elementIsMetaElementWithName(element, name) {
  const tagName = element.localName
  return tagName == "meta" && element.getAttribute("name") == name
}

/** @param {Element} element
 * @returns {Element}
 */
function elementWithoutNonce(element) {
  if (element.hasAttribute("nonce")) {
    element.setAttribute("nonce", "")
  }

  return element
}

/** @typedef {{ [outerHTML: string]: ElementDetails }} ElementDetailMap */
/**
 * @typedef {{
 *   type?: ElementType
 *   tracked: boolean
 *   elements: Element[]
 * }} ElementDetails
 */
/** @typedef {"script" | "stylesheet"} ElementType */
