/** Distance transform implementation based on the following paper.
 *
 * Distance Transforms of Sampled Functions
 * P. Felzenszwalb, D. Huttenlocher
 * Theory of Computing, Vol. 8, No. 19, September 2012
 *
 * Copyright 2015  Kota Yamaguchi
 */
const INF = 1e20

export type Edge = {
  width: number
  height: number
  data: Float32Array
}

function distanceTransform1D(f: Float32Array, n: number) {
  const d = new Float32Array(n)
  const v = new Int32Array(n)
  const z = new Float32Array(n + 1)
  let k = 0
  const square = function (x: number) {
    return x * x
  }

  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q <= n - 1; ++q) {
    let s = (f[q] + square(q) - (f[v[k]] + square(v[k]))) / (2 * q - 2 * v[k])
    if (isNaN(s)) throw "NaN error"
    while (s <= z[k]) {
      --k
      s = (f[q] + square(q) - (f[v[k]] + square(v[k]))) / (2 * q - 2 * v[k])
      if (isNaN(s)) throw "NaN error"
    }
    ++k
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q <= n - 1; ++q) {
    while (z[k + 1] < q) k++
    d[q] = square(q - v[k]) + f[v[k]]
  }
  return d
}

function distanceTransform2D(distanceMap: Edge) {
  const width = distanceMap.width
  const height = distanceMap.height
  const data = distanceMap.data
  const f = new Float32Array(Math.max(width, height))
  let d

  // Column transform.
  for (let x = 0; x < width; ++x) {
    for (let y = 0; y < height; ++y) f[y] = data[y * width + x]
    d = distanceTransform1D(f, height)
    for (let y = 0; y < height; ++y) data[y * width + x] = d[y]
  }
  // Row transform.
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) f[x] = data[y * width + x]
    d = distanceTransform1D(f, width)
    for (let x = 0; x < width; ++x) data[y * width + x] = d[x]
  }
  // Sqrt.
  for (let x = 0; x < data.length; ++x) data[x] = Math.sqrt(data[x])
}

export function distanceTransform(intensity: Edge) {
  const distanceMap = {
    width: intensity.width,
    height: intensity.height,
    data: new Float32Array(intensity.data.length),
  }
  for (let offset = 0; offset < distanceMap.data.length; ++offset)
    distanceMap.data[offset] = intensity.data[offset] ? 0 : INF
  distanceTransform2D(distanceMap)
  return distanceMap
}
