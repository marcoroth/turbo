import { Snapshot } from "../snapshot"
import { View } from "../view"

/** @extends View<FrameElement> */
export class FrameView extends View {
  /** @returns {void} */
  missing() {
    this.element.innerHTML = `<strong class="turbo-frame-error">Content missing</strong>`
  }

  get snapshot() {
    return new Snapshot(this.element)
  }
}

/** @typedef {ViewRenderOptions<FrameElement>} FrameViewRenderOptions */
