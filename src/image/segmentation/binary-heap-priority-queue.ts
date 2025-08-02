type Comparator<T> = (a: T, b: T) => number

interface BinaryHeapPriorityQueueOptions<T> {
  comparator?: Comparator<T>
  initialValues?: T[]
}

export default class BinaryHeapPriorityQueue<T = number> {
  private comparator: Comparator<T>
  private data: T[]
  public length: number

  constructor(options: BinaryHeapPriorityQueueOptions<T> = {}) {
    this.comparator =
      options.comparator ||
      ((a: any, b: any) => a - b)
    this.data = options.initialValues ? options.initialValues.slice(0) : []
    this.length = this.data.length
    if (this.data.length > 0) {
      for (let i = 1; i <= this.data.length; ++i) this._bubbleUp(i)
    }
  }

  push(value: T): this {
    this.data.push(value)
    this.length = this.data.length
    this._bubbleUp(this.data.length - 1)
    return this
  }

  shift(): T | undefined {
    const value = this.data[0]
    const last = this.data.pop()
    this.length = this.data.length
    if (this.length > 0 && last !== undefined) {
      this.data[0] = last
      this._bubbleDown(0)
    }
    return value
  }

  peek(): T | undefined {
    return this.data[0]
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >>> 1
      if (this.comparator(this.data[i], this.data[parent]) < 0) {
        const value = this.data[parent]
        this.data[parent] = this.data[i]
        this.data[i] = value
        i = parent
      } else break
    }
  }

  private _bubbleDown(i: number): void {
    const last = this.data.length - 1
    while (true) {
      const left = (i << 1) + 1,
        right = left + 1
      let minIndex = i
      if (left <= last && this.comparator(this.data[left], this.data[minIndex]) < 0) minIndex = left
      if (right <= last && this.comparator(this.data[right], this.data[minIndex]) < 0) minIndex = right
      if (minIndex !== i) {
        const value = this.data[minIndex]
        this.data[minIndex] = this.data[i]
        this.data[i] = value
        i = minIndex
      } else break
    }
  }
}
