export function createImageData(width, height) {
  const context = document.createElement("canvas").getContext("2d")
  return context.createImageData(width, height)
}
