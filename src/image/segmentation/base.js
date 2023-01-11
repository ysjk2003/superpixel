/**
 * Base class for over-segmentation algorithms.
 *
 * Copyright 2015  Kota Yamaguchi
 */
import { createImageData } from "../compat"

export class BaseSegmentation {
  constructor(imageData) {
    if (!(imageData instanceof ImageData)) throw "Invaild ImageData"
    this.imageData = createImageData(imageData.width, imageData.height)
    this.imageData.data.set(imageData.data)
  }

  finer(scale) {
    throw new Error("makeNoise() must be implement.")
  }
  coarser(scale) {
    throw new Error("makeNoise() must be implement.")
  }
}
