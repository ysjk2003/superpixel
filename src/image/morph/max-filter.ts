/** Max filter for an index image.
 *
 * Copyright 2015  Kota Yamaguchi
 */
import NeighborMap from "./neighbor-map"

function findDominantLabel(data: Int32Array, neighbors: number[]) {
  const histogram: { [key: string | number]: number } = {}
  let label
  for (let i = 0; i < neighbors.length; ++i) {
    label = data[neighbors[i]]
    if (histogram[label]) ++histogram[label]
    else histogram[label] = 1
  }
  const labels = Object.keys(histogram)
  let count = 0,
    dominantLabel = null
  for (let i = 0; i < labels.length; ++i) {
    label = labels[i]
    if (histogram[label] > count) {
      dominantLabel = parseInt(label, 10)
      count = histogram[label]
    }
  }
  return dominantLabel
}

export default function maxFilter(
  indexImage: { width: number; height: number; data: Int32Array },
  options?: { neighbors?: number[][] },
) {
  options = options || {}
  const neighbors = options.neighbors || [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ],
    result = new Int32Array(indexImage.data.length),
    neighborMap = new NeighborMap(indexImage.width, indexImage.height, neighbors)
  for (let i = 0; i < indexImage.data.length; ++i) {
    const dominantLabel = findDominantLabel(indexImage.data, neighborMap.get(i))
    if (dominantLabel) result[i] = dominantLabel
  }
  return {
    width: indexImage.width,
    height: indexImage.height,
    data: result,
  }
}
