/** Image morphology operations and index image I/O.
 *
 * Copyright 2015  Kota Yamaguchi
 */

export function decodeIndexImage(imageData: ImageData) {
  const indexImage = {
    width: imageData.width,
    height: imageData.height,
    data: new Int32Array(imageData.width * imageData.height),
  }
  for (let i = 0; i < imageData.data.length; ++i) {
    const offset = 4 * i
    indexImage.data[i] =
      imageData.data[offset + 0] | (imageData.data[offset + 1] << 8) | (imageData.data[offset + 2] << 16)
  }
  return indexImage
}
