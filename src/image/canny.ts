/** Canny edge detection.
 *
 *  var edge = canny(imageData, {});
 *
 * Copyright 2015  Kota Yamaguchi
 */

import { Edge } from "./distance-transform"

function createIntensityData(width: number, height: number) {
  return {
    width: width,
    height: height,
    data: new Float32Array(width * height),
  }
}

function createGaussian1D(k: number, sigma: number) {
  k = k || 1
  sigma = sigma || 1.3
  const size = 2 * k + 1
  const kernel = new Float32Array(size)
  const coeff = 1 / (2 * Math.PI * Math.pow(sigma, 2))
  for (let i = 0; i < size; ++i) kernel[i] = coeff * Math.exp(-Math.pow((i - k) / sigma, 2))
  return normalize(kernel)
}

function normalize(array: Float32Array<ArrayBuffer>) {
  let sum = 0
  for (let i = 0; i < array.length; ++i) sum += array[i]
  for (let i = 0; i < array.length; ++i) array[i] /= sum
  return array
}

function rgb2intensity(imageData: ImageData) {
  const intensity = createIntensityData(imageData.width, imageData.height)
  const newData = intensity.data
  const data = imageData.data
  for (let i = 0; i < imageData.width * imageData.height; ++i) {
    newData[i] = (data[4 * i] + data[4 * i + 1] + data[4 * i + 2]) / (3 * 255)
  }
  return intensity
}

function padImage(intensity: Edge, size: number | [number, number]) {
  size = size || [0, 0]
  if (typeof size === "number") size = [size, size]
  const width = intensity.width
  const height = intensity.height
  const data = intensity.data
  const newIntensity = createIntensityData(width + 2 * size[0], height + 2 * size[1])
  const newData = newIntensity.data

  for (let i = 0; i < newIntensity.height; ++i) {
    const y = i < size[1] ? size[1] - i : i >= height + size[1] ? 2 * height - size[1] + 1 - i : i - size[1]
    for (let j = 0; j < newIntensity.width; ++j) {
      const x = j < size[0] ? size[0] - j : j >= width + size[0] ? 2 * width - size[0] + 1 - j : j - size[0],
        newOffset = i * newIntensity.width + j,
        oldOffset = y * width + x
      newData[newOffset] = data[oldOffset]
    }
  }
  return newIntensity
}

function filter1D(intensity: Edge, kernel: ArrayLike<number>, horizontal: boolean) {
  const size = Math.round((kernel.length - 1) / 2)
  const paddedData = padImage(intensity, horizontal ? [size, 0] : [0, size])
  const data = paddedData.data
  const width = paddedData.width
  const height = paddedData.height
  const temporaryData = new Float32Array(data.length)
  let offset, value
  if (horizontal) {
    for (let i = 0; i < height; ++i) {
      for (let j = size; j < width - size; ++j) {
        offset = i * width + j
        value = kernel[size] * data[offset]
        for (let k = 1; k <= size; ++k) {
          value += kernel[size + k] * data[offset + k] + kernel[size - k] * data[offset - k]
        }
        temporaryData[offset] = value
      }
    }
  } else {
    for (let i = size; i < height - size; ++i) {
      for (let j = 0; j < width; ++j) {
        offset = i * width + j
        value = kernel[size] * data[offset]
        for (let k = 1; k <= size; ++k) {
          value += kernel[size + k] * data[offset + width * k] + kernel[size - k] * data[offset - width * k]
        }
        temporaryData[offset] = value
      }
    }
  }
  paddedData.data.set(temporaryData)
  return padImage(paddedData, horizontal ? [-size, 0] : [0, -size])
}

function filter1DTwice(intensity: Edge, kernel: Float32Array<ArrayBuffer>) {
  return filter1D(filter1D(intensity, kernel, true), kernel, false)
}

function detectEdges(intensity: Edge, options: { highThreshold: number; lowThreshold: number }) {
  const width = intensity.width
  const height = intensity.height
  const magnitude = new Float32Array(intensity.data.length)
  const orientation = new Float32Array(intensity.data.length)
  const suppressed = new Float32Array(intensity.data.length)
  const result = createIntensityData(width, height)
  const SobelKernel = [-1, 0, 1]
  const dx = filter1D(intensity, SobelKernel, true)
  const dy = filter1D(intensity, SobelKernel, false)
  let i
  let j
  let direction
  let offset
  let offset1 = 0
  let offset2 = 0
  for (i = 0; i < intensity.data.length; ++i) {
    magnitude[i] = Math.sqrt(Math.pow(dx.data[i], 2) + Math.pow(dy.data[i], 2))
    direction = Math.atan2(dy.data[i], dx.data[i])
    orientation[i] = direction < 0 ? direction + Math.PI : direction > Math.PI ? direction - Math.PI : direction
  }
  // NMS.
  for (i = 1; i < height - 1; ++i) {
    for (j = 1; j < width - 1; ++j) {
      offset = i * width + j
      direction = orientation[offset]
      if (direction < Math.PI / 8 || (7 * Math.PI) / 8 <= direction) {
        offset1 = offset - 1
        offset2 = offset + 1
      } else if (Math.PI / 8 <= direction && direction < (3 * Math.PI) / 8) {
        offset1 = offset - width - 1
        offset2 = offset + width + 1
      } else if ((3 * Math.PI) / 8 <= direction && direction < (5 * Math.PI) / 8) {
        offset1 = offset - width
        offset2 = offset + width
      } else if ((5 * Math.PI) / 8 <= direction && direction < (7 * Math.PI) / 8) {
        offset1 = offset - width + 1
        offset2 = offset + width - 1
      }
      suppressed[offset] =
        magnitude[offset] > magnitude[offset1] && magnitude[offset] > magnitude[offset2] ? magnitude[offset] : 0
    }
  }
  // Hysteresis.
  for (i = 1; i < height - 1; ++i) {
    for (j = 1; j < width - 1; ++j) {
      offset = i * width + j
      direction = orientation[offset] - 0.5 * Math.PI
      direction = direction < 0 ? direction + Math.PI : direction
      if (direction < Math.PI / 8 || (7 * Math.PI) / 8 <= direction) {
        offset1 = offset - 1
        offset2 = offset + 1
      } else if (Math.PI / 8 <= direction && direction < (3 * Math.PI) / 8) {
        offset1 = offset - width - 1
        offset2 = offset + width + 1
      } else if ((3 * Math.PI) / 8 <= direction && direction < (5 * Math.PI) / 8) {
        offset1 = offset - width
        offset2 = offset + width
      } else if ((5 * Math.PI) / 8 <= direction && direction < (7 * Math.PI) / 8) {
        offset1 = offset - width + 1
        offset2 = offset + width - 1
      }
      result.data[offset] =
        suppressed[offset] >= options.highThreshold ||
        (suppressed[offset] >= options.lowThreshold && suppressed[offset1] >= options.highThreshold) ||
        (suppressed[offset] >= options.lowThreshold && suppressed[offset2] >= options.highThreshold)
          ? suppressed[offset]
          : 0
    }
  }

  return { ...result, magnitude }
}

type Options = {
  kernelTail?: number
  sigma?: number
  highThreshold?: number
  lowThreshold?: number
}

export function canny(imageData: ImageData, options?: Options) {
  const kernelTail = options?.kernelTail ?? 4
  const sigma = options?.sigma ?? 1.6
  const highThreshold = options?.highThreshold ?? 0.04
  const lowThreshold = options?.lowThreshold ?? 0.3 * highThreshold

  const intensity = rgb2intensity(imageData)
  const gaussianKernel = createGaussian1D(kernelTail, sigma)
  const blurredData = filter1DTwice(intensity, gaussianKernel)
  const edge = detectEdges(blurredData, { highThreshold, lowThreshold })
  return edge
}
