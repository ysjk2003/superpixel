export default class BinaryHeapPriorityQueue {
  constructor(options) {
    options = options || {}
    this.comparator =
      options.comparator ||
      function (a, b) {
        return a - b
      }
    this.data = options.initialValues ? options.initialValues.slice(0) : []
    this.length = this.data.length
    if (this.data.length > 0) for (var i = 1; i <= this.data.length; ++i) this._bubbleUp(i)
  }

  push(value) {
    this.data.push(value)
    this.length = this.data.length
    this._bubbleUp(this.data.length - 1)
    return this
  }

  shift() {
    var value = this.data[0],
      last = this.data.pop()
    this.length = this.data.length
    if (this.length > 0) {
      this.data[0] = last
      this._bubbleDown(0)
    }
    return value
  }

  peek() {
    return this.data[0]
  }

  _bubbleUp(i) {
    while (i > 0) {
      var parent = (i - 1) >>> 1
      if (this.comparator(this.data[i], this.data[parent]) < 0) {
        var value = this.data[parent]
        this.data[parent] = this.data[i]
        this.data[i] = value
        i = parent
      } else break
    }
  }

  _bubbleDown(i) {
    var last = this.data.length - 1
    while (true) {
      var left = (i << 1) + 1,
        right = left + 1,
        minIndex = i
      if (left <= last && this.comparator(this.data[left], this.data[minIndex]) < 0) minIndex = left
      if (right <= last && this.comparator(this.data[right], this.data[minIndex]) < 0) minIndex = right
      if (minIndex !== i) {
        var value = this.data[minIndex]
        this.data[minIndex] = this.data[i]
        this.data[i] = value
        i = minIndex
      } else break
    }
  }
}
