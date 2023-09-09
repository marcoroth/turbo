import { Renderer } from "../renderer"
import { activateScriptElement } from "../../util"

/** @extends Renderer<HTMLBodyElement, PageSnapshot> */
export class ErrorRenderer extends Renderer {
  /** @static
   * @param {HTMLBodyElement} currentElement
   * @param {HTMLBodyElement} newElement
   * @returns {void}
   */
  static renderElement(currentElement, newElement) {
    const { documentElement, body } = document

    documentElement.replaceChild(newElement, body)
  }

  /** @returns {Promise<void>} */
  async render() {
    this.replaceHeadAndBody()
    this.activateScriptElements()
  }

  /** @returns {void} */
  replaceHeadAndBody() {
    const { documentElement, head } = document
    documentElement.replaceChild(this.newHead, head)
    this.renderElement(this.currentElement, this.newElement)
  }

  /** @returns {void} */
  activateScriptElements() {
    for (const replaceableElement of this.scriptElements) {
      const parentNode = replaceableElement.parentNode
      if (parentNode) {
        const element = activateScriptElement(replaceableElement)
        parentNode.replaceChild(element, replaceableElement)
      }
    }
  }

  get newHead() {
    return this.newSnapshot.headSnapshot.element
  }

  get scriptElements() {
    return document.documentElement.querySelectorAll("script")
  }
}
