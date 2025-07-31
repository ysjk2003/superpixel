export function createImageData(width: number, height: number) {
  const context = document.createElement("canvas").getContext("2d")
  if (context === null) throw Error("Canvas Not Detected")
  return context.createImageData(width, height)
}
