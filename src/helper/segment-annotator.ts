/**
 * Segment annotation widget.
 *
 * var annotator = new SegmentAnnotator("/path/to/image.jpg", {
 *   onload: function () {},
 *   onerror: function () {},
 *   onchange: function () {},
 *   onrightclick: function () {},
 *   onleftclick: function () {}
 * });
 * document.body.appendChild(annotator.container);
 *
 * Copyright 2015  Kota Yamaguchi
 */
import Layer from "../image/layer"
import * as morph from "../image/morph"
import maxFilter from "../image/morph/max-filter"
import { createSegment } from "../image/segmentation"
import PFF from "../image/segmentation/pff"
import SLIC from "../image/segmentation/slic"
import SLICO from "../image/segmentation/slico"
import WatershedSegmentation from "../image/segmentation/watershed"

type Options = {
  onload?: () => void
  onerror?: () => OnErrorEventHandler
  onchange: () => void
  onrightclick: (label: number) => void
  onleftclick?: () => void
  onmousemove: (label: number | null) => void
  onhighlight?: () => void
  width?: number
  height?: number
  colormap: number[][]
  boundaryColor?: number[]
  boundaryAlpha?: number
  visualizationAlpha?: number
  highlightAlpha?: number
  defaultLabel?: number
  maxHistoryRecord?: number
  superpixelOptions: SuperpixelOptions
  grayscale?: boolean
}

export type SuperpixelOptions = { method: string; regionSize: number; minRegionSize?: number; maxIterations?: number }
type AnnotatorLayers = { image: Layer; superpixel: Layer; visualization: Layer; annotation: Layer; boundary: Layer }
type Update = { pixels: number[]; prev: number[]; next: number[] }

// Segment annotator.
export default class Annotator {
  private colormap: number[][]
  private boundaryColor: number[]
  private boundaryAlpha: number
  private visualizationAlpha: number
  private highlightAlpha: number
  private currentZoom: number
  private defaultLabel: number
  private maxHistoryRecord: number
  private onchange: () => void | null
  private onrightclick: (label: number) => void | null
  private onleftclick: ((label: number) => void) | null
  private onmousemove: (label: number | null) => void | null
  private onhighlight: (() => void) | null
  private mode: string
  private polygonPoints: number[][]
  private prevAnnotationImg: null | ImageData
  private layers!: AnnotatorLayers
  private segmentation!: SLIC | SLICO | PFF | WatershedSegmentation
  private _container!: HTMLDivElement
  private innerContainer!: HTMLDivElement
  private width: number = 0
  private height: number = 0
  private currentHistoryRecord: number = 0
  public currentLabel: number = 0
  private pixelIndex: number[][] = []
  private currentPixels: number[] | null = null
  private history: Update[] = []

  get container() {
    return this._container
  }

  constructor(imageURL: string, options: Options) {
    if (typeof imageURL !== "string") {
      throw "Invalid imageURL"
    }
    this.colormap = options.colormap || [
      [255, 255, 255],
      [255, 0, 0],
    ]
    this.boundaryColor = options.boundaryColor || [255, 255, 255]
    this.boundaryAlpha = options.boundaryAlpha || 127
    this.visualizationAlpha = options.visualizationAlpha || 144
    this.highlightAlpha = options.highlightAlpha || Math.min(255, this.visualizationAlpha + 128)
    this.currentZoom = 1.0
    this.defaultLabel = options.defaultLabel || 0
    this.maxHistoryRecord = options.maxHistoryRecord || 10
    this.onchange = options.onchange || null
    this.onrightclick = options.onrightclick || null
    this.onleftclick = options.onleftclick || null
    this.onhighlight = options.onhighlight || null
    this.onmousemove = options.onmousemove || null
    this._createLayers(options)
    this._initializeHistory()
    this.mode = "superpixel"
    this.polygonPoints = []
    this.prevAnnotationImg = null
    const annotator = this
    this.layers.image.load(imageURL, {
      width: options?.width,
      height: options?.height,
      onload: function () {
        annotator._initialize(options)
      },
      onerror: options?.onerror,
    })
  }

  resetSuperpixels(options: SuperpixelOptions) {
    this.layers.superpixel.copy(this.layers.image)
    this.segmentation = createSegment(this.layers.image.imageData, options)
    this._updateSuperpixels()
    return this
  }

  finer() {
    this.segmentation.finer()
    this._updateSuperpixels()
    return this
  }

  coarser() {
    this.segmentation.coarser()
    this._updateSuperpixels()
    return this
  }

  undo() {
    if (this.currentHistoryRecord < 0) return false
    const record = this.history[this.currentHistoryRecord--]
    this._fillPixels(record.pixels, record.prev)
    this.layers.visualization.render()
    if (typeof this.onchange === "function") this.onchange.call(this)
    return this.currentHistoryRecord < 0
  }

  redo() {
    if (this.currentHistoryRecord >= this.history.length - 1) return false
    const record = this.history[++this.currentHistoryRecord]
    this._fillPixels(record.pixels, record.next)
    this.layers.visualization.render()
    if (typeof this.onchange === "function") this.onchange.call(this)
    return this.currentHistoryRecord >= this.history.length
  }

  getUniqueLabels() {
    const uniqueIndex = [],
      data = this.layers.annotation.imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const label = _getEncodedLabel(data, i)
      if (uniqueIndex.indexOf(label) < 0) {
        uniqueIndex.push(label)
      }
    }
    return uniqueIndex.sort(function (a, b) {
      return a - b
    })
  }

  fill(targetLabel: number) {
    const pixels = [],
      annotationData = this.layers.annotation.imageData.data
    for (let i = 0; i < annotationData.length; i += 4) {
      const label = _getEncodedLabel(annotationData, i)
      if (label === targetLabel || targetLabel === undefined) pixels.push(i)
    }
    if (pixels.length > 0) this._updateAnnotation(pixels, this.currentLabel)
    return this
  }

  setAlpha(alpha: number) {
    this.visualizationAlpha = Math.max(Math.min(alpha, 255), 0)
    this.layers.visualization.setAlpha(this.visualizationAlpha).render()
    return this
  }

  lessAlpha(scale?: number) {
    return this.setAlpha(this.visualizationAlpha - (scale || 1) * 20)
  }

  moreAlpha(scale?: number) {
    return this.setAlpha(this.visualizationAlpha + (scale || 1) * 20)
  }

  import(annotationURL: string, options?: Options) {
    const annotator = this
    this.layers.annotation.load(annotationURL, {
      onload: function (this: Layer) {
        if (options?.grayscale) this.gray2index()
        annotator.layers.visualization
          .copy(this)
          .applyColormap(annotator.colormap)
          .setAlpha(annotator.visualizationAlpha)
          .render()
        this.setAlpha(0).render()
        annotator.history = []
        annotator.currentHistoryRecord = -1
        if (typeof options?.onload === "function") options?.onload.call(annotator)
        if (typeof annotator.onchange === "function") annotator.onchange.call(annotator)
      },
      onerror: options?.onerror,
    })
    return this
  }

  export() {
    this.layers.annotation.setAlpha(255)
    this.layers.annotation.render()
    const data = this.layers.annotation.canvas.toDataURL()
    this.layers.annotation.setAlpha(0)
    this.layers.annotation.render()
    return data
  }

  show(layer: keyof typeof this.layers) {
    this.layers[layer].canvas.style.display = "inline-block"
    return this
  }

  hide(layer: keyof typeof this.layers) {
    this.layers[layer].canvas.style.display = "none"
    return this
  }

  highlightLabel(label: number) {
    const pixels = [],
      annotationData = this.layers.annotation.imageData.data
    for (let i = 0; i < annotationData.length; i += 4) {
      const currentLabel = _getEncodedLabel(annotationData, i)
      if (currentLabel === label) pixels.push(i)
    }
    this._updateHighlight(pixels)
    return this
  }

  unhighlightLabel() {
    this._updateHighlight(null)
    return this
  }

  zoom(scale: number) {
    this.currentZoom = Math.max(Math.min(scale || 1.0, 10.0), 1.0)
    this.innerContainer.style.transform = "scale(" + this.currentZoom + ")"
    return this
  }

  zoomIn(scale?: number) {
    return this.zoom(this.currentZoom + (scale || 0.25))
  }

  zoomOut(scale?: number) {
    return this.zoom(this.currentZoom - (scale || 0.25))
  }

  denoise() {
    const indexImage = morph.decodeIndexImage(this.layers.annotation.imageData),
      result = maxFilter(indexImage)
    const pixels = new Int32Array(result.data.length)
    for (let i = 0; i < pixels.length; ++i) pixels[i] = 4 * i
    this._updateAnnotation(pixels, result.data)
    return this
  }

  _createLayers(options: Options) {
    const onload = options.onload
    if (options.onload) delete options.onload
    this._container = document.createElement("div")
    this._container.classList.add("segment-annotator-outer-container")
    this.innerContainer = document.createElement("div")
    this.innerContainer.classList.add("segment-annotator-inner-container")
    this.layers = {
      image: new Layer(undefined, options),
      superpixel: new Layer(undefined, options),
      visualization: new Layer(undefined, options),
      boundary: new Layer(undefined, options),
      annotation: new Layer(undefined, options),
    }
    options.onload = onload
    for (const key in this.layers) {
      const canvas = this.layers[key as keyof typeof this.layers].canvas
      canvas.classList.add("segment-annotator-layer")
      this.innerContainer.appendChild(canvas)
    }
    this._container.appendChild(this.innerContainer)
    this._resizeLayers(options)
  }

  _resizeLayers(options: Options) {
    this.width = options.width || this.layers.image.canvas.width
    this.height = options.height || this.layers.image.canvas.height
    for (const key in this.layers) {
      if (key !== "image") {
        const canvas = this.layers[key as keyof typeof this.layers].canvas
        canvas.width = this.width
        canvas.height = this.height
      }
    }
    this.innerContainer.style.width = this.width + "px"
    this.innerContainer.style.height = this.height + "px"
    this._container.style.width = this.width + "px"
    this._container.style.height = this.height + "px"
  }

  _initializeHistory() {
    this.history = []
    this.currentHistoryRecord = -1
  }

  _initialize(options: Options) {
    if (!options.width) this._resizeLayers(options)
    this._initializeAnnotationLayer()
    this._initializeVisualizationLayer()
    this._initializeEvents()
    this.resetSuperpixels(options.superpixelOptions)
    if (typeof options.onload === "function") options.onload.call(this)
    if (typeof this.onchange === "function") this.onchange.call(this)
  }

  _initializeEvents() {
    const canvas = this.layers.annotation.canvas,
      mousestate = { down: false, button: 0 },
      annotator = this
    canvas.oncontextmenu = function () {
      return false
    }
    function updateIfActive(event: MouseEvent) {
      const offset = annotator._getClickOffset(event),
        superpixelData = annotator.layers.superpixel.imageData.data,
        annotationData = annotator.layers.annotation.imageData.data,
        superpixelIndex = _getEncodedLabel(superpixelData, offset),
        pixels = annotator.pixelIndex[superpixelIndex],
        existingLabel = _getEncodedLabel(annotationData, offset)
      if (annotator.mode === "superpixel") annotator._updateHighlight(pixels)
      if (typeof annotator.onmousemove === "function") annotator.onmousemove.call(annotator, existingLabel)
      if (mousestate.down) {
        if (mousestate.button == 2 && typeof annotator.onrightclick === "function") {
          if (annotator.mode === "polygon") annotator._emptyPolygonPoints() //reset
          else annotator.onrightclick.call(annotator, existingLabel)
        } else {
          if (annotator.mode === "brush" && event.button === 0) {
            annotator.brush(annotator._getClickPos(event), annotator.currentLabel)
          }
          if (event.button === 0 && annotator.mode === "polygon") {
            annotator._addPolygonPoint(event)
            if (annotator._checkLineIntersection()) annotator._addPolygonToAnnotation()
          } else if (annotator.mode === "superpixel") {
            annotator._updateAnnotation(pixels, annotator.currentLabel)
          }
          if (typeof annotator.onleftclick === "function") annotator.onleftclick.call(annotator, annotator.currentLabel)
        }
      }
    }
    canvas.addEventListener("mousemove", updateIfActive)
    canvas.addEventListener("mouseup", updateIfActive)
    canvas.addEventListener("mouseleave", function () {
      annotator._updateHighlight(null)
      if (typeof annotator.onmousemove === "function") {
        annotator.onmousemove.call(annotator, null)
      }
    })
    canvas.addEventListener("mousedown", function (event) {
      mousestate.down = true
      mousestate.button = event.button
    })
    window.addEventListener("mouseup", function () {
      mousestate.down = false
    })
    //polygon on/off with ctrl-key
    window.onkeyup = function (e) {
      const key = e.keyCode ? e.keyCode : e.which
      if (key == 17) {
        if (annotator.mode == "polygon") {
          annotator.mode = "superpixel"
        } else {
          annotator.mode = "polygon"
          annotator._updateHighlight(null)
        }
        annotator._emptyPolygonPoints()
      }
    }
  }

  _updateBoundaryLayer() {
    const boundaryLayer = this.layers.boundary
    boundaryLayer.copy(this.layers.superpixel)
    boundaryLayer.computeEdgemap({
      foreground: this.boundaryColor.concat(this.boundaryAlpha),
      background: this.boundaryColor.concat(0),
    })
    boundaryLayer.render()
  }

  _initializeAnnotationLayer() {
    const layer = this.layers.annotation
    layer.resize(this.width, this.height)
    this.currentLabel = this.defaultLabel
    layer.fill([this.defaultLabel, 0, 0, 0])
    layer.render()
  }

  _initializeVisualizationLayer() {
    const layer = this.layers.visualization
    layer.resize(this.width, this.height)
    const initialColor = this.colormap[this.defaultLabel].concat([this.visualizationAlpha])
    layer.fill(initialColor)
    layer.render()
  }

  _updateSuperpixels() {
    const annotator = this
    this.layers.superpixel.process(function (this: Layer, imageData: ImageData) {
      if (annotator.segmentation.result?.data) imageData.data.set(annotator.segmentation.result.data)
      // TODO:: separated result and numb segments
      //@ts-ignore
      annotator._createPixelIndex(annotator.segmentation.result.numSegments)
      annotator._updateBoundaryLayer()
      this.setAlpha(0).render()
    })
  }

  _createPixelIndex(numSegments: number) {
    const pixelIndex = new Array(numSegments),
      data = this.layers.superpixel.imageData.data

    for (let i = 0; i < numSegments; ++i) pixelIndex[i] = []
    for (let i = 0; i < data.length; i += 4) {
      const index = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16)
      pixelIndex[index].push(i)
    }
    this.currentPixels = null
    this.pixelIndex = pixelIndex
  }

  _getClickOffset(event: MouseEvent) {
    const pos = this._getClickPos(event),
      x = pos[0],
      y = pos[1]
    return 4 * (y * this.layers.visualization.canvas.width + x)
  }

  _getClickPos(event: MouseEvent) {
    const container = this._container,
      containerRect = container.getBoundingClientRect(),
      offsetLeft =
        containerRect.left +
        (window.pageXOffset || document.documentElement.scrollLeft) -
        (document.documentElement.clientLeft || 0),
      offsetTop =
        containerRect.top +
        (window.pageYOffset || document.documentElement.scrollTop) -
        (document.documentElement.clientTop || 0)
    let x = Math.round(
        (event.pageX - offsetLeft + container.scrollLeft) * (container.offsetWidth / container.scrollWidth),
      ),
      y = Math.round(
        (event.pageY - offsetTop + container.scrollTop) * (container.offsetHeight / container.scrollHeight),
      )
    x = Math.max(Math.min(x, this.layers.visualization.canvas.width - 1), 0)
    y = Math.max(Math.min(y, this.layers.visualization.canvas.height - 1), 0)
    return [x, y]
  }

  _addPolygonPoint(event: MouseEvent) {
    const annotator = this,
      pos = this._getClickPos(event),
      x = pos[0],
      y = pos[1]
    //get canvas.
    const canvas = annotator.layers.annotation.canvas,
      ctx = canvas.getContext("2d")
    if (!ctx) return
    if (this.polygonPoints.length === 0) {
      ctx.save() // remember previous state.
      annotator.prevAnnotationImg = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
    // draw.
    ctx.fillStyle = "#FA6900"
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 1
    if (this.polygonPoints.length === 0) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    this.polygonPoints.push(pos)
  }

  _emptyPolygonPoints() {
    const annotator = this,
      ctx = annotator.layers.annotation.canvas.getContext("2d")
    if (!ctx) return
    ctx.restore()
    if (annotator.prevAnnotationImg) ctx.putImageData(annotator.prevAnnotationImg, 0, 0)
    //reset polygon-points
    annotator.polygonPoints = []
  }

  _addPolygonToAnnotation() {
    const annotator = this,
      canvas = document.createElement("canvas")
    let x, y
    // set canvas dimensions.
    canvas.width = annotator.layers.annotation.canvas.width
    canvas.height = annotator.layers.annotation.canvas.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "rgba(0, 0, 255, 255)"
    ctx.beginPath()
    ctx.moveTo(annotator.polygonPoints[0][0], annotator.polygonPoints[0][1])
    for (let i = 1; i < annotator.polygonPoints.length; ++i) {
      x = annotator.polygonPoints[i][0]
      y = annotator.polygonPoints[i][1]
      ctx.lineTo(x, y)
    }
    ctx.lineTo(annotator.polygonPoints[0][0], annotator.polygonPoints[0][1])
    ctx.closePath()
    ctx.fill()
    //get pixels within polygon.
    const colorToCheck = [0, 0, 255, 255],
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height),
      data = imageData.data,
      pixelsPolygon = []
    for (x = 0; x < canvas.width; ++x) {
      for (y = 0; y < canvas.height; ++y) {
        const index = (x + y * imageData.width) * 4
        if (
          data[index + 0] == colorToCheck[0] &&
          data[index + 1] == colorToCheck[1] &&
          data[index + 2] == colorToCheck[2] &&
          data[index + 3] == colorToCheck[3]
        ) {
          pixelsPolygon.push(index)
        }
      }
    }
    // update annotation.
    annotator._updateAnnotation(pixelsPolygon, annotator.currentLabel)
    annotator._emptyPolygonPoints()
  }

  _checkLineIntersection() {
    if (this.polygonPoints.length < 4) return false
    const newLineStartX = this.polygonPoints[this.polygonPoints.length - 2][0],
      newLineStartY = this.polygonPoints[this.polygonPoints.length - 2][1],
      newLineEndX = this.polygonPoints[this.polygonPoints.length - 1][0],
      newLineEndY = this.polygonPoints[this.polygonPoints.length - 1][1]

    for (let i = 1; i < this.polygonPoints.length - 2; ++i) {
      const line1StartX = this.polygonPoints[i - 1][0],
        line1StartY = this.polygonPoints[i - 1][1],
        line1EndX = this.polygonPoints[i][0],
        line1EndY = this.polygonPoints[i][1],
        denominator =
          (newLineEndY - newLineStartY) * (line1EndX - line1StartX) -
          (newLineEndX - newLineStartX) * (line1EndY - line1StartY)
      let a = line1StartY - newLineStartY,
        b = line1StartX - newLineStartX
      const numerator1 = (newLineEndX - newLineStartX) * a - (newLineEndY - newLineStartY) * b,
        numerator2 = (line1EndX - line1StartX) * a - (line1EndY - line1StartY) * b
      a = numerator1 / denominator
      b = numerator2 / denominator
      if (a > 0 && a < 1 && b > 0 && b < 1) return true
    }
    return false
  }

  _setMode(mode: string) {
    this.mode = mode
  }

  _updateHighlight(pixels: number[] | null) {
    const visualizationData = this.layers.visualization.imageData.data,
      boundaryData = this.layers.boundary.imageData.data,
      annotationData = this.layers.annotation.imageData.data

    let color, offset
    if (this.currentPixels !== null) {
      for (let i = 0; i < this.currentPixels.length; ++i) {
        offset = this.currentPixels[i]
        color = this.colormap[_getEncodedLabel(annotationData, offset)]
        visualizationData[offset + 0] = color[0]
        visualizationData[offset + 1] = color[1]
        visualizationData[offset + 2] = color[2]
        visualizationData[offset + 3] = this.visualizationAlpha
      }
    }
    this.currentPixels = pixels
    if (this.currentPixels !== null && pixels !== null) {
      for (let i = 0; i < pixels.length; ++i) {
        offset = pixels[i]
        if (boundaryData[offset + 3]) {
          visualizationData[offset + 0] = this.boundaryColor[0]
          visualizationData[offset + 1] = this.boundaryColor[1]
          visualizationData[offset + 2] = this.boundaryColor[2]
          visualizationData[offset + 3] = this.highlightAlpha
        } else {
          visualizationData[offset + 3] = this.highlightAlpha
        }
      }
    }
    this.layers.visualization.render()
    this.layers.boundary.render()
    if (typeof this.onhighlight === "function") this.onhighlight.call(this)
  }

  _fillPixels(pixels: number[], labels: number[]) {
    if (pixels.length !== labels.length) throw "Invalid fill: " + pixels.length + " !== " + labels.length
    const annotationData = this.layers.annotation.imageData.data,
      visualizationData = this.layers.visualization.imageData.data
    for (let i = 0; i < pixels.length; ++i) {
      const offset = pixels[i],
        label = labels[i],
        color = this.colormap[label]
      _setEncodedLabel(annotationData, offset, label)
      visualizationData[offset + 0] = color[0]
      visualizationData[offset + 1] = color[1]
      visualizationData[offset + 2] = color[2]
    }
  }

  _updateAnnotation(pixels: number[] | Int32Array, labels: number[] | Int32Array | number) {
    const _labels = typeof labels === "object" ? labels : _fillArray(new Int32Array(pixels.length), labels)
    const updates = this._getDifferentialUpdates(pixels, _labels)
    if (updates.pixels.length === 0) return this
    this._updateHistory(updates)
    this._fillPixels(updates.pixels, updates.next)
    this.layers.visualization.render()
    if (typeof this.onchange === "function") this.onchange.call(this)
    return this
  }

  _getDifferentialUpdates(pixels: number[] | Int32Array, labels: number[] | Int32Array) {
    if (pixels.length !== labels.length) throw "Invalid labels"
    const annotationData = this.layers.annotation.imageData.data,
      updates: Update = { pixels: [], prev: [], next: [] }
    for (let i = 0; i < pixels.length; ++i) {
      const label = _getEncodedLabel(annotationData, pixels[i])
      if (label !== labels[i]) {
        updates.pixels.push(pixels[i])
        updates.prev.push(label)
        updates.next.push(labels[i])
      }
    }
    return updates
  }

  _updateHistory(updates: Update) {
    this.history = this.history.slice(0, this.currentHistoryRecord + 1)
    this.history.push(updates)
    if (this.history.length > this.maxHistoryRecord) this.history = this.history.slice(1, this.history.length)
    else ++this.currentHistoryRecord
  }

  brush(pos: number[], label: number) {
    const offsets = [],
      labels = []
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        // it is circle bitches
        if (x * x + y * y > 7) continue
        const offset = 4 * ((pos[1] + y) * this.layers.visualization.canvas.width + (pos[0] + x))
        offsets.push(offset)
        labels.push(label)
      }
    }
    this._updateAnnotation(offsets, labels)
    this.layers.visualization.render()
    if (typeof this.onchange === "function") this.onchange.call(this)
  }
}

function _fillArray(array: Int32Array, value: number) {
  for (let i = 0; i < array.length; ++i) array[i] = value
  return array
}

function _getEncodedLabel(array: Uint8ClampedArray, offset: number) {
  return array[offset] | (array[offset + 1] << 8) | (array[offset + 2] << 16)
}

function _setEncodedLabel(array: Uint8ClampedArray, offset: number, label: number) {
  array[offset + 0] = label & 255
  array[offset + 1] = (label >>> 8) & 255
  array[offset + 2] = (label >>> 16) & 255
  array[offset + 3] = 255
}
