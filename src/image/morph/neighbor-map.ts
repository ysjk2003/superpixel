/** Create a map of neighbor offsets.
 *
 *  var neighborMap = new NeighborMap(width, height);
 *  for (var i = 0; i < data.length; ++i) {
 *    var neighbors = neighborMap.get(i);
 *    for (var j = 0; j < neighbors.length; ++j) {
 *      var pixel = data[neighbors[j]];
 *    }
 *  }
 *
 * Copyright 2015  Kota Yamaguchi
 */
// Neighbor Map.
export default class NeighborMap {
  private neighbors: number[][]
  private maps: Int32Array[]

  constructor(width: number, height: number, neighbors: number[][]) {
    this.neighbors = neighbors || [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]
    this.maps = []
    for (let k = 0; k < this.neighbors.length; ++k) {
      const dy = this.neighbors[k][0],
        dx = this.neighbors[k][1],
        map = new Int32Array(width * height)
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          const Y = y + dy,
            X = x + dx
          map[y * width + x] = Y < 0 || height <= Y || X < 0 || width <= X ? -1 : Y * width + X
        }
      }
      this.maps.push(map)
    }
  }

  get(offset: number) {
    const neighborOffsets = []
    for (let k = 0; k < this.neighbors.length; ++k) {
      const neighborOffset = this.maps[k][offset]
      if (neighborOffset >= 0) neighborOffsets.push(neighborOffset)
    }
    return neighborOffsets
  }
}
