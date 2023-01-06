/** Index page renderer.
 */
import Pagination from "../helper/pagination"
import Viewer from "../helper/segment-viewer"
import * as util from "../helper/util"
import { Params, Data } from "../main"

function createLabelOptions(params: Params, labels: string[]) {
  const container = document.createElement("p")
  const select = document.createElement("select")
  const option = document.createElement("option")
  option.appendChild(document.createTextNode("all"))
  select.appendChild(option)
  for (let i = 0; i < labels.length; ++i) {
    const option = document.createElement("option")
    option.appendChild(document.createTextNode(labels[i]))
    if (labels[i] === params.label) {
      option.selected = true
    }
    select.appendChild(option)
  }
  select.onchange = function (event) {
    window.location.href = util.makeQueryParams(params, {
      label: event.target instanceof HTMLSelectElement && event.target.value !== "all" ? event.target.value : null,
    })
  }
  container.appendChild(select)
  return container
}

export function render(data: Data, params: Params) {
  const pagination = new Pagination(data.imageURLs.length, params)
  document.body.appendChild(pagination.render())
  document.body.appendChild(createLabelOptions(params, data.labels))
  for (let i = pagination.begin(); i < pagination.end(); ++i) {
    const viewer = new Viewer(data.imageURLs[i], data.annotationURLs[i], {
        width: 240,
        height: 320,
        colormap: data.colormap,
        labels: data.labels,
        excludedLegends: [0],
        overlay: i.toString(),
      }),
      anchor = document.createElement("a")
    anchor.appendChild(viewer.container)
    anchor.href = util.makeQueryParams({ view: "edit", id: i.toString() })
    document.body.appendChild(anchor)
  }
}
