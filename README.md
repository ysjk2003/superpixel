# Superpixel

Javascript image annotation tool based on image segmentation.

 * Label image regions with mouse.
 * Written in vanilla Javascript, with require.js dependency (packaged).
 * Pure client-side implementation of image segmentation.

A browser must support HTML canvas to use this tool.

There is an [online demo](http://kyamagu.github.io/js-segment-annotator/?view=index).

## How to use
```
npm install superpixel
```
```js
import SLIC from "superpixel/src/image/segmentation/slic"

const imageData = new ImageData() //Image data for which you want to know the result value of superpixel
const slic = new SLIC(imageData)

const canvas = document.createElement("canvas")
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
ctx.putImageData(slic.result, 0, 0)
ctx.imageSmoothingEnabled = true
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
const data = this.computeEdgeMap(imageData)
ctx.putImageData(new ImageData(data, this.canvas.width, this.canvas.height), 0, 0)
```

## Known issues

_Browser incompatibility_

A segmentation result can greatly differ due to the difference in Javascript
implementation across Web browsers. The difference stems from numerical
precision of floating point numbers, and there is no easy way to produce the
exact same result across browsers.

## TODO

* convert es6 syntax
* support typescript

## Citation

This repository based on [here](https://github.com/kyamagu/js-segment-annotator)
