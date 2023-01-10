import { Color } from "../main"

/** Image canvas wrapper.
 *
 * Example:
 *
 *  var layer = new Layer("/path/to/image.jpg", {
 *    onload: function () {
 *      this.resize(200, 300);
 *      document.body.appendChild(this.canvas);
 *    }
 *  });
 *
 * Copyright 2015  Kota Yamaguchi
 */
type Options = {
  width?: number
  height?: number
  onerror?: () => OnErrorEventHandler
  onload?: () => void
  imageSmoothingEnabled?: boolean
}

// Canvas wrapper object.
export default class Layer {
  private _canvas: HTMLCanvasElement
  private _imageData!: ImageData

  get imageData() {
    return this._imageData
  }
  get canvas() {
    return this._canvas
  }

  constructor(source?: string | HTMLImageElement | HTMLCanvasElement | ImageData, options?: Options) {
    options = options || {}
    this._canvas = document.createElement("canvas")
    this._canvas.width = options.width || this._canvas.width
    this._canvas.height = options.height || this._canvas.height
    if (source) {
      if (typeof source === "string" || source instanceof HTMLImageElement) this.load(source, options)
      else if (source instanceof HTMLCanvasElement || source instanceof ImageData) this.fromCanvas(source, options)
    }
  }

  load(source: string | HTMLImageElement, options: Options | ((this: Layer) => void)) {
    const _options: Options = typeof options === "function" ? { onload: options } : options
    let image: HTMLImageElement
    const layer = this
    this._canvas.width = _options.width || this._canvas.width
    this._canvas.height = _options.height || this._canvas.height
    if (typeof source === "string") {
      image = new Image()
      image.src = source
    } else image = source
    image.onload = function () {
      layer._onImageLoad(image, _options)
    }
    if (typeof _options.onerror === "function") image.onerror = _options.onerror.call(this)
    return this
  }

  _onImageLoad(image: HTMLImageElement, options: Options) {
    this._canvas.width = options.width || image.width
    this._canvas.height = options.height || image.height
    const context = this._canvas.getContext("2d") as CanvasRenderingContext2D
    this._setImageSmoothing(context, options)
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, this._canvas.width, this._canvas.height)
    this._imageData = context.getImageData(0, 0, this._canvas.width, this._canvas.height)
    if (typeof options.onload === "function") options.onload.call(this)
  }

  fromCanvas(source: HTMLCanvasElement | ImageData, options?: Options) {
    options = options || {}
    if (typeof options === "function") options = { onload: options }
    this._canvas.width = source.width
    this._canvas.height = source.height
    const context = this._canvas.getContext("2d") as CanvasRenderingContext2D
    this._setImageSmoothing(context, options)
    if (source instanceof ImageData) context.putImageData(source, 0, 0)
    else context.drawImage(source, 0, 0, this._canvas.width, this._canvas.height)
    this._imageData = context.getImageData(0, 0, this._canvas.width, this._canvas.height)
    if (typeof options.onload === "function") options.onload.call(this)
    return this
  }

  fromImageData(imageData: HTMLImageElement, options?: Options) {
    if (typeof options === "function") options = { onload: options }
    this._canvas.width = imageData.width
    this._canvas.height = imageData.height
    const context = this._canvas.getContext("2d") as CanvasRenderingContext2D
    this._setImageSmoothing(context, options)
    context.drawImage(imageData, 0, 0, this._canvas.width, this._canvas.height)
    this._imageData = context.getImageData(0, 0, this._canvas.width, this._canvas.height)
    if (typeof options?.onload === "function") options?.onload.call(this)
    return this
  }

  _setImageSmoothing(context: CanvasRenderingContext2D, options?: Options) {
    context.imageSmoothingEnabled = options?.imageSmoothingEnabled !== undefined ? options.imageSmoothingEnabled : true
  }

  copy(source: Layer) {
    source.render()
    this.fromCanvas(source._canvas)
    return this
  }

  process(callback: (imageData: ImageData) => void) {
    if (typeof callback !== "function") throw "Invalid callback"
    callback.call(this, this._imageData)
    return this.render()
  }

  render() {
    if (this._imageData) (this._canvas.getContext("2d") as CanvasRenderingContext2D).putImageData(this._imageData, 0, 0)
    return this
  }

  setAlpha(alpha: number) {
    const data = this._imageData.data
    for (let i = 3; i < data.length; i += 4) data[i] = alpha
    return this
  }

  fill(rgba: number[]) {
    const data = this._imageData.data
    for (let i = 0; i < data.length; i += 4) for (let j = 0; j < rgba.length; ++j) data[i + j] = rgba[j]
    return this
  }

  resize(width: number, height: number, options?: Options) {
    const temporaryCanvas = document.createElement("canvas"),
      tempoaryContext = temporaryCanvas.getContext("2d") as CanvasRenderingContext2D
    temporaryCanvas.width = width
    temporaryCanvas.height = height
    tempoaryContext.drawImage(this._canvas, 0, 0, width, height)
    this._canvas.width = width
    this._canvas.height = height
    const context = this._canvas.getContext("2d") as CanvasRenderingContext2D
    this._setImageSmoothing(context, options)
    context.drawImage(temporaryCanvas, 0, 0)
    this._imageData = context.getImageData(0, 0, width, height)
    return this
  }

  applyColormap(colormap: number[][], grayscale?: boolean) {
    const data = this._imageData.data
    if (typeof grayscale === "undefined") grayscale = true
    for (let i = 0; i < data.length; i += 4) {
      let index = data[i]
      if (!grayscale) index |= (data[i + 1] << 8) | (data[i + 2] << 16)
      data[i + 0] = colormap[index][0]
      data[i + 1] = colormap[index][1]
      data[i + 2] = colormap[index][2]
    }
    return this
  }

  computeEdgemap(options: { background: number[]; foreground: number[] }) {
    const data = this._imageData.data,
      width = this._imageData.width,
      height = this._imageData.height,
      edgeMap = new Uint8Array(this._imageData.data),
      foreground = options.foreground || [255, 255, 255],
      background = options.background || [0, 0, 0]
    let i, j, k
    for (i = 0; i < height; ++i) {
      for (j = 0; j < width; ++j) {
        const offset = 4 * (i * width + j),
          index = data[4 * (i * width + j)],
          isBoundary =
            i === 0 ||
            j === 0 ||
            i === height - 1 ||
            j === width - 1 ||
            index !== data[4 * (i * width + j - 1)] ||
            index !== data[4 * (i * width + j + 1)] ||
            index !== data[4 * ((i - 1) * width + j)] ||
            index !== data[4 * ((i + 1) * width + j)]
        if (isBoundary) {
          for (k = 0; k < foreground.length; ++k) edgeMap[offset + k] = foreground[k]
        } else {
          for (k = 0; k < background.length; ++k) edgeMap[offset + k] = background[k]
        }
      }
    }
    data.set(edgeMap)
    return this
  }

  gray2index() {
    const data = this._imageData.data
    for (let i = 0; i < data.length; i += 4) {
      data[i + 1] = 0
      data[i + 2] = 0
    }
    return this
  }
}
