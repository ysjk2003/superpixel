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
// Canvas wrapper object.
export default class Layer {
  constructor(source, options) {
    options = options || {}
    this.canvas = document.createElement("canvas")
    this.canvas.width = options.width || this.canvas.width
    this.canvas.height = options.height || this.canvas.height
    if (source) {
      if (typeof source === "string" || (typeof source === "object" && source.nodeName === "IMG"))
        this.load(source, options)
      else if (typeof source === "object" && (source.nodeName === "CANVAS" || source instanceof ImageData))
        this.fromCanvas(source, options)
    }
  }

  load(source, options) {
    options = options || {}
    if (typeof options === "function") options = { onload: options }
    var image,
      layer = this
    this.canvas.width = options.width || this.canvas.width
    this.canvas.height = options.height || this.canvas.height
    if (typeof source === "string") {
      image = new Image()
      image.src = source
    } else image = source
    image.onload = function () {
      layer._onImageLoad(image, options)
    }
    if (typeof options.onerror === "function") image.onerror = options.onerror.call(this)
    return this
  }

  _onImageLoad(image, options) {
    this.canvas.width = options.width || image.width
    this.canvas.height = options.height || image.height
    var context = this.canvas.getContext("2d")
    this._setImageSmoothing(context, options)
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, this.canvas.width, this.canvas.height)
    this.imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height)
    if (typeof options.onload === "function") options.onload.call(this)
  }

  fromCanvas(source, options) {
    options = options || {}
    if (typeof options === "function") options = { onload: options }
    this.canvas.width = source.width
    this.canvas.height = source.height
    var context = this.canvas.getContext("2d")
    this._setImageSmoothing(context, options)
    if (source instanceof ImageData) context.putImageData(source, 0, 0)
    else context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height)
    this.imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height)
    if (typeof options.onload === "function") options.onload.call(this)
    return this
  }

  fromImageData(imageData, options) {
    options = options || {}
    if (typeof options === "function") options = { onload: options }
    this.canvas.width = imageData.width
    this.canvas.height = imageData.height
    var context = this.canvas.getContext("2d")
    this._setImageSmoothing(context, options)
    context.drawImage(imageData, 0, 0, this.canvas.width, this.canvas.height)
    this.imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height)
    if (typeof options.onload === "function") options.onload.call(this)
    return this
  }

  _setImageSmoothing(context, options) {
    if (typeof options.imageSmoothingEnabled === "undefined") options.imageSmoothingEnabled = true
    context.mozImageSmoothingEnabled = options.imageSmoothingEnabled
    context.webkitImageSmoothingEnabled = options.imageSmoothingEnabled
    context.msImageSmoothingEnabled = options.imageSmoothingEnabled
    context.imageSmoothingEnabled = options.imageSmoothingEnabled
  }

  copy(source) {
    source.render()
    this.fromCanvas(source.canvas)
    return this
  }

  process(callback) {
    if (typeof callback !== "function") throw "Invalid callback"
    callback.call(this, this.imageData)
    return this.render()
  }

  render() {
    if (this.imageData) this.canvas.getContext("2d").putImageData(this.imageData, 0, 0)
    return this
  }

  setAlpha(alpha) {
    var data = this.imageData.data
    for (var i = 3; i < data.length; i += 4) data[i] = alpha
    return this
  }

  fill(rgba) {
    var data = this.imageData.data
    for (var i = 0; i < data.length; i += 4) for (var j = 0; j < rgba.length; ++j) data[i + j] = rgba[j]
    return this
  }

  resize(width, height, options) {
    options = options || {}
    var temporaryCanvas = document.createElement("canvas"),
      tempoaryContext = temporaryCanvas.getContext("2d")
    temporaryCanvas.width = width
    temporaryCanvas.height = height
    tempoaryContext.drawImage(this.canvas, 0, 0, width, height)
    this.canvas.width = width
    this.canvas.height = height
    var context = this.canvas.getContext("2d")
    this._setImageSmoothing(context, options)
    context.drawImage(temporaryCanvas, 0, 0)
    this.imageData = context.getImageData(0, 0, width, height)
    return this
  }

  applyColormap(colormap, grayscale) {
    var data = this.imageData.data
    if (typeof grayscale === "undefined") grayscale = true
    for (var i = 0; i < data.length; i += 4) {
      var index = data[i]
      if (!grayscale) index |= (data[i + 1] << 8) | (data[i + 2] << 16)
      data[i + 0] = colormap[index][0]
      data[i + 1] = colormap[index][1]
      data[i + 2] = colormap[index][2]
    }
    return this
  }

  computeEdgemap(options) {
    if (typeof options === "undefined") options = {}
    var data = this.imageData.data,
      width = this.imageData.width,
      height = this.imageData.height,
      edgeMap = new Uint8Array(this.imageData.data),
      foreground = options.foreground || [255, 255, 255],
      background = options.background || [0, 0, 0],
      i,
      j,
      k
    for (i = 0; i < height; ++i) {
      for (j = 0; j < width; ++j) {
        var offset = 4 * (i * width + j),
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
    var data = this.imageData.data
    for (var i = 0; i < data.length; i += 4) {
      data[i + 1] = 0
      data[i + 2] = 0
    }
    return this
  }
}
