/** Segmentation viewer.
 *
 * var viewer = new Viewer("/path/to/image.jpg", "/path/to/annotation.png", {
 *   colormap: [[255, 255, 255], [0, 255, 255]],
 *   labels: ["background", "foreground"],
 *   onload: function () { }
 * });
 * document.body.appendChild(viewer.container);
 *
 * Copyright 2015  Kota Yamaguchi
 */
import Layer from "../image/layer"

type Options = {
  colormap: number[][]
  labels: string[]
  width: number
  height: number
  onerror?: () => OnErrorEventHandler
  onload?: () => void
  overlay: string
  excludedLegends: number[]
}

// Segment viewer.
export default class Viewer {
  private colormap: number[][]
  private labels: string[]
  private layers!: { image: Layer; visualization: Layer }
  public container!: HTMLDivElement
  private _unloadedLayers!: number
  private width!: number
  private height!: number

  constructor(imageURL: string, annotationURL: string, options: Options) {
    this.colormap = options.colormap || [
      [255, 255, 255],
      [255, 0, 0],
    ]
    this.labels = options.labels
    this._createLayers(imageURL, annotationURL, options)
    const viewer = this
    this.layers.image.load(imageURL, {
      width: options.width,
      height: options.height,
      onload: function () {
        viewer._initializeIfReady(options)
      },
    })
    this.layers.visualization.load(annotationURL, {
      width: options.width,
      height: options.height,
      imageSmoothingEnabled: false,
      onload: function () {
        viewer._initializeIfReady(options)
      },
      onerror: options.onerror,
    })
    if (options.overlay) viewer.addOverlay(options.overlay)
  }

  _createLayers(imageURL: string, annotationURL: string, options: Options) {
    const onload = options.onload
    delete options.onload
    this.container = document.createElement("div")
    this.container.classList.add("segment-viewer-container")
    this.layers = {
      image: new Layer(undefined, options),
      visualization: new Layer(undefined, options),
    }
    options.onload = onload
    for (const key in this.layers) {
      const canvas = this.layers[key as keyof typeof this.layers].canvas
      canvas.classList.add("segment-viewer-layer")
      this.container.appendChild(canvas)
    }
    this._unloadedLayers = Object.keys(this.layers).length
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
    this.container.style.width = this.width + "px"
    this.container.style.height = this.height + "px"
  }

  _initializeIfReady(options: Options) {
    if (--this._unloadedLayers > 0) return
    this._resizeLayers(options)
    const viewer = this
    this.layers.visualization.process(function (this: Layer, imageData: ImageData) {
      const uniqueIndex = getUniqueIndex(this.imageData.data)
      this.applyColormap(viewer.colormap)
      this.setAlpha(192)
      this.render()
      if (viewer.labels)
        viewer.addLegend(
          uniqueIndex.filter(function (x) {
            return (options.excludedLegends || []).indexOf(x) < 0
          }),
        )
    })
  }

  addOverlay(text: string) {
    const overlayContainer = document.createElement("div")
    overlayContainer.classList.add("segment-viewer-overlay-container")
    if (text) overlayContainer.appendChild(document.createTextNode(text))
    this.container.appendChild(overlayContainer)
  }

  addLegend(index?: number[]) {
    const legendContainer = document.createElement("div")
    if (typeof index === "undefined") {
      index = []
      for (let i = 0; i < this.labels.length; ++i) index.push(i)
    }
    legendContainer.classList.add("segment-viewer-legend-container")
    for (let i = 0; i < index.length; ++i) {
      const label = this.labels[index[i]],
        color = this.colormap[index[i]],
        legendItem = document.createElement("div"),
        colorbox = document.createElement("span"),
        legendLabel = document.createElement("span")
      colorbox.classList.add("segment-viewer-legend-colorbox")
      colorbox.style.backgroundColor = "rgb(" + color.join(",") + ")"
      legendItem.classList.add("segment-viewer-legend-item")
      legendLabel.appendChild(document.createTextNode(" " + label))
      legendLabel.classList.add("segment-viewer-legend-label")
      legendItem.appendChild(colorbox)
      legendItem.appendChild(legendLabel)
      legendContainer.appendChild(legendItem)
    }
    this.container.appendChild(legendContainer)
  }
}

export const getUniqueIndex = function (data: Uint8ClampedArray) {
  const uniqueIndex = []
  for (let i = 0; i < data.length; i += 4) {
    if (uniqueIndex.indexOf(data[i]) < 0) {
      uniqueIndex.push(data[i])
    }
  }
  return uniqueIndex.sort(function (a, b) {
    return a - b
  })
}
