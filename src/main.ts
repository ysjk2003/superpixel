/* Main page dispatcher.
 */
import * as editPage from "./app/edit"
import * as indexPage from "./app/index"
import Colormap from "./helper/colormap"
import * as util from "./helper/util"

type Color = [number, number, number]
export type Params = { label: string; view: string; width: number; height: number }
export type Data = {
  colormap: Color[]
  annotationURLs: string[]
  imageURLs: string[]
  labels: string[]
}
type Renderer = (data: Data, params: Params) => void

const dataURL = "./data/example.json" // Change this to another dataset.
const params: Params = util.getQueryParams() as Params

// Create a colormap for display. The following is an example.
function createColormap(label: string, labels: string[]) {
  return label
    ? Colormap.single({
        size: labels.length,
        index: labels.indexOf(label),
      })
    : [
        [255, 255, 255],
        [226, 196, 196],
        [64, 32, 32],
      ].concat(
        Colormap.hsv({
          size: labels.length - 3,
        }),
      )
}

// Load dataset before rendering a view.
function renderPage(renderer: Renderer) {
  util.requestJSON(dataURL, function (data: Data) {
    data.colormap = createColormap(params.label, data.labels)
    renderer(data, params)
  })
}

switch (params.view) {
  case "index":
    renderPage(indexPage.render)
    break
  case "edit":
    renderPage(editPage.render)
    break
  default:
    params.view = "index"
    window.location.href = util.makeQueryParams(params)
    break
}
