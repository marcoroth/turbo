import { toCacheKey } from "../url"

export class SnapshotCache {
  /** @readonly
   * @default []
   */
  keys = []
  /** @readonly */
  size = undefined
  /** @default {} */
  snapshots = {}

  constructor(size) {
    this.size = size
  }

  /** @param {URL} location
   * @returns {boolean}
   */
  has(location) {
    return toCacheKey(location) in this.snapshots
  }

  /** @param {URL} location
   * @returns {PageSnapshot | undefined}
   */
  get(location) {
    if (this.has(location)) {
      const snapshot = this.read(location)
      this.touch(location)
      return snapshot
    }
  }

  /** @param {URL} location
   * @param {PageSnapshot} snapshot
   * @returns {any}
   */
  put(location, snapshot) {
    this.write(location, snapshot)
    this.touch(location)
    return snapshot
  }

  /** @returns {void} */
  clear() {
    this.snapshots = {}
  }

  // Private

  /** @param {URL} location
   * @returns {any}
   */
  read(location) {
    return this.snapshots[toCacheKey(location)]
  }

  /** @param {URL} location
   * @param {PageSnapshot} snapshot
   * @returns {void}
   */
  write(location, snapshot) {
    this.snapshots[toCacheKey(location)] = snapshot
  }

  /** @param {URL} location
   * @returns {void}
   */
  touch(location) {
    const key = toCacheKey(location)
    const index = this.keys.indexOf(key)
    if (index > -1) this.keys.splice(index, 1)
    this.keys.unshift(key)
    this.trim()
  }

  /** @returns {void} */
  trim() {
    for (const key of this.keys.splice(this.size)) {
      delete this.snapshots[key]
    }
  }
}
