/**
 * Canny + Watershed segmentation algorithm.
 *
 *  var segmentation = new WatershedSegmentation(imageData);
 *  var result = segmentation.result;
 *  var result = segmentation.finer();
 *  var result = segmentation.coarser();
 *
 *  TODO:
 *  * Edge options other than canny.
 *  * Create a graph-structure for coarse/fine adjustment.
 *
 */
import { canny } from "../canny"
import { distanceTransform, Edge } from "../distance-transform"
import { BaseSegmentation } from "./base"
import BinaryHeapPriorityQueue from "./binary-heap-priority-queue"
// Constructor for the segmentation configuration.
export default class WatershedSegmentation extends BaseSegmentation {
  private sigmaRange: number[]
  private kernelRange: number[]
  private currentConfig: number
  private minRegionSize: number
  private highThreshold: number
  private lowThreshold: number
  private neighborMap8: NeighborMap
  private neighborMap4: NeighborMap
  private result:
    | (ImageData & {
        numSegments?: number
      })
    | undefined

  constructor(
    imageData: ImageData,
    options?: {
      kernelRange?: number[]
      sigmaRange?: number[]
      currentConfig?: number
      minRegionSize?: number
      highThreshold?: number
      lowThreshold?: number
    },
  ) {
    super(imageData)
    options = options || {}
    this.sigmaRange =
      options.sigmaRange ||
      [-2, -1, 0, 0.5, 1, 2, 3].map(function (n) {
        return Math.pow(2, n)
      })
    this.kernelRange = options.kernelRange || [2, 3, 4, 4, 4, 5, 6]
    this.currentConfig = options.currentConfig || Math.floor((this.sigmaRange.length - 1) / 2)
    this.minRegionSize = options.minRegionSize || 16
    this.highThreshold = options.highThreshold || 0.04
    this.lowThreshold = options.lowThreshold || 0.3 * this.highThreshold
    if (this.sigmaRange.length <= 0) throw "Invalid sigma range"
    this.neighborMap8 = new NeighborMap(this.imageData.width, this.imageData.height)
    this.neighborMap4 = new NeighborMap(this.imageData.width, this.imageData.height, [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
    ])
    this._compute()
  }

  finer() {
    if (this.currentConfig > 0) {
      --this.currentConfig
      if (this.imageData) this._compute()
    }
  }

  coarser() {
    if (this.currentConfig < this.sigmaRange.length - 1) {
      ++this.currentConfig
      if (this.imageData) this._compute()
    }
  }

  _compute() {
    const queue = new BinaryHeapPriorityQueue<number[]>({
      comparator: function (a: number[], b: number[]) {
        return a[0] - b[0]
      },
    })
    const edge = canny(this.imageData, {
      kernelTail: this.kernelRange[this.currentConfig],
      sigma: this.sigmaRange[this.currentConfig],
      lowThreshold: this.lowThreshold,
      highThreshold: this.highThreshold,
    })
    const seeds = this._findLocalMaxima(distanceTransform(edge))
    const labels = new Int32Array(edge.data.length)
    let i, j, offset, neighbors, neighborOffset
    // Initialize.
    for (i = 0; i < labels.length; ++i) labels[i] = -1
    for (i = 0; i < seeds.length; ++i) labels[seeds[i]] = i + 1
    for (i = 0; i < seeds.length; ++i) {
      neighbors = this.neighborMap8.get(seeds[i])
      for (j = 0; j < neighbors.length; ++j) {
        neighborOffset = neighbors[j]
        if (labels[neighborOffset] === -1) {
          queue.push([edge.magnitude[neighborOffset], neighborOffset])
          labels[neighborOffset] = -2
        }
      }
    }
    // Iterate until we label all pixels by non-border dilation.
    let iter = 0
    while (queue.length > 0) {
      offset = queue.shift()![1]
      neighbors = this.neighborMap8.get(offset)
      const uniqueLabel = this._findUniqueRegionLabel(neighbors, labels)
      if (uniqueLabel) {
        // Dilate when there is a unique region label.
        labels[offset] = uniqueLabel
        for (i = 0; i < neighbors.length; ++i) {
          neighborOffset = neighbors[i]
          if (labels[neighborOffset] === -1) {
            labels[neighborOffset] = -2
            queue.push([edge.magnitude[neighborOffset], neighborOffset])
          }
        }
      } else labels[offset] = 0 // Boundary.
      if (++iter > labels.length) throw "Too many iterations"
    }
    // Remove boundaries and small regions.
    this.erode(0, labels)
    this._removeSmallRegions(labels)
    const numSegments = this._relabel(labels)
    this.result = this._encodeLabels(labels)
    this.result.numSegments = numSegments
  }

  _findLocalMaxima(intensity: Edge) {
    const data = intensity.data
    const maximaMap = new Uint8Array(data.length)
    const offsets = []

    for (let offset = 0; offset < data.length; ++offset) {
      const neighbors = this.neighborMap8.get(offset)
      let flag = true
      for (let k = 0; k < neighbors.length; ++k) flag = flag && data[offset] >= data[neighbors[k]]
      maximaMap[offset] = Number(flag)
    }
    // Erase connected seeds.
    const suppressed = new Uint8Array(maximaMap.length)
    for (let offset = 0; offset < data.length; ++offset) {
      const neighbors = this.neighborMap4.get(offset)
      let flag = true
      for (let k = 0; k < neighbors.length; ++k) flag = flag && maximaMap[offset] > maximaMap[neighbors[k]]
      suppressed[offset] = Number(flag)
    }
    for (let offset = 0; offset < suppressed.length; ++offset) if (suppressed[offset]) offsets.push(offset)
    return offsets
  }

  _findUniqueRegionLabel(neighbors: number[], labels: Int32Array<ArrayBuffer>) {
    const uniqueLabels = []
    for (let i = 0; i < neighbors.length; ++i) {
      const label = labels[neighbors[i]]
      if (label > 0 && uniqueLabels.indexOf(label) < 0) uniqueLabels.push(label)
    }
    return uniqueLabels.length === 1 ? uniqueLabels[0] : null
  }

  _findDominantLabel(neighbors: number[], labels: Int32Array<ArrayBuffer>, target: number) {
    const histogram: { [key: number]: number } = {}

    for (let i = 0; i < neighbors.length; ++i) {
      const label = labels[neighbors[i]]
      if (label !== target) {
        if (histogram[label]) ++histogram[label]
        else histogram[label] = 1
      }
    }
    let count = 0,
      dominantLabel = null
    for (const label in histogram) {
      if (histogram[label] > count) {
        dominantLabel = label
        count = histogram[label]
      }
    }
    return dominantLabel
  }

  erode(target: number, labels: Int32Array<ArrayBuffer>) {
    const offsets: number[] = []
    const updates: { [key: number | string]: number } = {}

    for (let offset = 0; offset < labels.length; ++offset) if (labels[offset] === target) offsets.push(offset)
    if (target !== 0 && offsets.length === 0) throw "No pixels for label " + target
    updates[target] = 0
    let iter = 0
    while (offsets.length > 0) {
      const offset = offsets.shift()!
      const neighbors = this.neighborMap8.get(offset)
      const dominantLabel = this._findDominantLabel(neighbors, labels, target)
      if (dominantLabel !== null) {
        labels[offset] = Number(dominantLabel)
        if (updates[dominantLabel]) ++updates[dominantLabel]
        else updates[dominantLabel] = 1
        --updates[target]
      } else offsets.push(offset)
      if (++iter > labels.length) throw "Too many iterations for label " + target
    }
    return updates
  }

  _findSmallLabel(histogram: { [key: number]: number }) {
    let smallLabel = null
    for (const label in histogram) {
      const count = histogram[label]
      if (0 < count && count < this.minRegionSize) {
        smallLabel = parseInt(label, 10)
        break
      }
    }
    return smallLabel
  }

  _removeSmallRegions(labels: Int32Array<ArrayBuffer>) {
    const histogram: { [key: number | string]: number } = {}

    for (let offset = 0; offset < labels.length; ++offset) {
      const label = labels[offset]
      if (histogram[label]) ++histogram[label]
      else histogram[label] = 1
    }
    let iter = 0
    while (true) {
      const smallLabel = this._findSmallLabel(histogram)
      if (smallLabel !== null) {
        const updates = this.erode(smallLabel, labels)
        for (const label in updates) histogram[label] += updates[label]
      } else break
      if (++iter >= Object.keys(histogram).length) throw "Too many iterations"
    }
  }

  _relabel(labels: Int32Array<ArrayBuffer>) {
    const uniqueArray = []
    for (let i = 0; i < labels.length; ++i) {
      let index = uniqueArray.indexOf(labels[i])
      if (index < 0) {
        index = uniqueArray.length
        uniqueArray.push(labels[i])
      }
      labels[i] = index
    }
    return uniqueArray.length
  }

  _encodeLabels(labels: Int32Array<ArrayBuffer>) {
    const imageData = new ImageData(this.imageData.width, this.imageData.height),
      data = imageData.data
    for (let i = 0; i < labels.length; ++i) {
      const value = labels[i]
      data[4 * i] = 255 & value
      data[4 * i + 1] = 255 & (value >> 8)
      data[4 * i + 2] = 255 & (value >> 16)
      data[4 * i + 3] = 255
    }
    return imageData
  }
}

// Neighbor Map.
class NeighborMap {
  private neighbors: number[][]
  private maps: Int32Array[]

  constructor(width: number, height: number, neighbors?: number[][]) {
    this.neighbors = neighbors || [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]
    this.maps = []
    for (let k = 0; k < this.neighbors.length; ++k) {
      const dy = this.neighbors[k][0],
        dx = this.neighbors[k][1],
        map = new Int32Array(width * height)
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          const Y = y + dy,
            X = x + dx
          map[y * width + x] = Y < 0 || height <= Y || X < 0 || width <= X ? -1 : Y * width + X
        }
      }
      this.maps.push(map)
    }
  }

  get(offset: number) {
    const neighborOffsets = []
    for (let k = 0; k < this.neighbors.length; ++k) {
      const neighborOffset = this.maps[k][offset]
      if (neighborOffset >= 0) neighborOffsets.push(neighborOffset)
    }
    return neighborOffsets
  }
}
