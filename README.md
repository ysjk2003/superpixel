# Superpixel

Javascript image annotation tool based on image segmentation.

 * Label image regions with mouse.
 * Written in vanilla Javascript, with require.js dependency (packaged).
 * Pure client-side implementation of image segmentation.

A browser must support HTML canvas to use this tool.

There is an [online demo](http://kyamagu.github.io/js-segment-annotator/?view=index).

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
