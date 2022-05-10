/** Pagination helper.
 *
 *  Example:
 *
 *    var pagination = new Pagination(100, params);
 *    document.body.appendChild(pagination.render());
 *
 * Copyright 2015  Kota Yamaguchi
 */
import { makeQueryParams } from "./util"

export default class Pagination {
  constructor(count, params) {
    this.anchor = undefined
    this.page = parseInt(params.page || 0, 10)
    this.perPage = parseInt(params.per_page || 30, 10)
    this.neighbors = parseInt(params.page_neighbors || 2, 10)
    this.pages = Math.ceil(count / this.perPage)
    this.startIndex = Math.min(Math.max(this.page * this.perPage, 0), count)
    this.endIndex = Math.min(Math.max((this.page + 1) * this.perPage, 0), count)
  }

  begin() {
    return this.startIndex
  }
  end() {
    return this.endIndex
  }
  render(options) {
    options = options || {}
    const index = []
    for (let i = 0; i < this.pages; ++i) {
      if (
        i <= (this.page <= this.neighbors ? 2 : 1) * this.neighbors ||
        (this.page - this.neighbors <= i && i <= this.page + this.neighbors) ||
        this.pages - (this.page >= this.pages - this.neighbors - 1 ? 2 : 1) * this.neighbors <= i
      )
        index.push(i)
    }
    const container = document.createElement(options.nodeType || "p")
    {
      this.anchor = document.createElement("a")
      if (this.page > 0) this.anchor.href = makeQueryParams(this.params, { page: this.page - 1 })
      this.anchor.appendChild(document.createTextNode("Prev"))
      container.appendChild(this.anchor)
      container.appendChild(document.createTextNode(" "))
    }
    for (let i = 0; i < index.length; ++i) {
      this.anchor = document.createElement("a")
      if (index[i] !== this.page) this.anchor.href = makeQueryParams(this.params, { page: index[i] })
      this.anchor.appendChild(document.createTextNode(index[i]))
      container.appendChild(this.anchor)
      container.appendChild(document.createTextNode(" "))
      if (i < index.length - 1 && index[i] + 1 != index[i + 1]) container.appendChild(document.createTextNode("... "))
    }
    {
      this.anchor = document.createElement("a")
      if (this.page < this.pages - 1) this.anchor.href = makeQueryParams(this.params, { page: this.page + 1 })
      this.anchor.appendChild(document.createTextNode("Next"))
      container.appendChild(this.anchor)
    }
    return container
  }
}
