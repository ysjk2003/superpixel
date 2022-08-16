export default class Colormap {
  static random(options) {
    var colormap = []
    for (var i = 0; i < options.size; ++i)
      colormap.push([Math.floor(256 * Math.random()), Math.floor(256 * Math.random()), Math.floor(256 * Math.random())])
    return colormap
  }

  static gray(options) {
    var colormap = []
    for (var i = 0; i < options.size; ++i) {
      var intensity = Math.round((255 * i) / options.size)
      colormap.push([intensity, intensity, intensity])
    }
    return colormap
  }

  static hsv(options) {
    var colormap = [],
      saturation = options.saturation === undefined ? 1 : options.saturation
    for (var i = 0; i < options.size; ++i) colormap.push(hsv2rgb(i / options.size, saturation, 1))
    return colormap
  }

  static hhsv(options) {
    var colormap = [],
      depth = options.depth || 2,
      saturationBlocks = [],
      i
    for (i = 0; i < depth; ++i) saturationBlocks[i] = 0
    for (i = 0; i < options.size; ++i) saturationBlocks[Math.floor((depth * i) / options.size)] += 1
    for (i = 0; i < depth; ++i) {
      colormap = colormap.concat(
        Colormap.hsv({
          size: saturationBlocks[i],
          saturation: 1 - i / depth,
        }),
      )
    }
    return colormap
  }

  static single(options) {
    var colormap = []
    for (var i = 0; i < options.size; ++i) {
      if (i === options.index) colormap.push(options.foreground || [255, 0, 0])
      else colormap.push(options.background || [255, 255, 255])
    }
    return colormap
  }
}

/** Compute RGB value from HSV.
 */
function hsv2rgb(h, s, v) {
  var i = Math.floor(h * 6),
    f = h * 6 - i,
    p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s),
    r,
    g,
    b
  switch (i % 6) {
    case 0:
      r = v
      g = t
      b = p
      break
    case 1:
      r = q
      g = v
      b = p
      break
    case 2:
      r = p
      g = v
      b = t
      break
    case 3:
      r = p
      g = q
      b = v
      break
    case 4:
      r = t
      g = p
      b = v
      break
    case 5:
      r = v
      g = p
      b = q
      break
  }
  return [r, g, b].map(function (x) {
    return Math.round(x * 255)
  })
}
