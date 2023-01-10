import { Data, Params } from "../main"

// Get JSON by AJAX request.
export function requestJSON(url: string, callback: (data: Data) => void) {
  const xmlhttp = new XMLHttpRequest()
  xmlhttp.onreadystatechange = function () {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      const data = xmlhttp.responseText
      callback(JSON.parse(data))
    }
  }
  xmlhttp.open("GET", url, true)
  xmlhttp.send()
}

// Parse query params.
export function getQueryParams(queryString?: string) {
  let tokens
  const params: { [key: string]: string } = {},
    re = /[?&]?([^=]+)=([^&]*)/g
  queryString = queryString || document.location.search
  while ((tokens = re.exec(queryString.split("+").join(" "))))
    params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2])
  return params
}

// Create a unique array.
export function unique(...args: string[][]) {
  const uniqueArray = []
  for (let i = 0; i < args.length; ++i) {
    const array = args[i]
    for (let j = 0; j < array.length; ++j) {
      if (uniqueArray.indexOf(array[j]) < 0) uniqueArray.push(array[j])
    }
  }
  return uniqueArray
}

// Create query params from an object.
export function makeQueryParams(params?: Params, updates?: Params) {
  params = params || {}
  updates = updates || {}
  let queryString = "?"
  const keys = unique(Object.keys(params), Object.keys(updates))
  for (let i = 0; i < keys.length; ++i) {
    let value = updates[keys[i]]
    if (value === null) continue
    else if (typeof value === "undefined") value = params[keys[i]]
    queryString =
      queryString + encodeURIComponent(keys[i]) + "=" + encodeURIComponent(value) + (i < keys.length - 1 ? "&" : "")
  }
  return queryString
}
