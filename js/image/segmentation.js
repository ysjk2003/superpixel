/** Image segmentation factory.
 *
 *  var segm = segmentation.create(imageData);
 *  var segmentData = segm.result;  // imageData with numSegments.
 *
 *  segm.finer();
 *  segm.coarser();
 *
 * Copyright 2015  Kota Yamaguchi
 */
import PFF from "./segmentation/pff"
import SLIC from "./segmentation/slic"
import SLICO from "./segmentation/slico"
import WatershedSegmentation from "./segmentation/watershed"

export function createSegment(imageData, options) {
  options = options || {}
  options.method = options.method || "slic"
  switch (options.method) {
    case "slic":
      return new SLIC(imageData, options)
    case "pff":
      return new PFF(imageData, options)
    case "slico":
      return new SLICO(imageData, options)
    case "watershed":
      return new WatershedSegmentation(imageData, options)
    default:
      throw "Invalid method: " + options.method
  }
}
