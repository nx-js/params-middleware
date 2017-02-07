'use strict'

const util = require('@nx-js/router-util')

const symbols = {
  config: Symbol('params sync config')
}
const watchedParams = new Map()
const paramsEventConfig = {bubbles: true, cancelable: true}
let urlParams = {}

window.addEventListener('popstate', onPopState)
window.addEventListener('params', onParams, true)

function onPopState (ev) {
  document.dispatchEvent(new CustomEvent('params', paramsEventConfig))
}

function onParams () {
  urlParams = {}
  watchedParams.forEach(syncStateWithParams)
  syncUrlWithParams()
}


module.exports = function paramsFactory (paramsConfig) {
  paramsConfig = paramsConfig || {}

  function params (elem, state, next) {
    const config = elem[symbols.config] = {
      tagName: elem.getAttribute('is') || elem.tagName,
      params: paramsConfig,
      elem
    }
    watchedParams.set(config, state)
    elem.$cleanup(unwatch, config)

    syncStateWithParams(state, config)
    syncUrlWithParams()
    next()
    config.signal = elem.$observe(syncParamsWithState, state, config)
  }
  params.$name = 'params'
  params.$require = ['observe']
  params.$type = 'component'
  return params
}

function unwatch (config) {
  watchedParams.delete(config)
}

function syncStateWithParams (state, config) {
  if (!document.documentElement.contains(config.elem)) {
    return
  }
  const params = history.state.params
  const paramsConfig = config.params
  let paramsChanged = false

  for (let paramName in paramsConfig) {
    let param = params[paramName]
    const paramConfig = paramsConfig[paramName]

    if (param === undefined && paramConfig.durable) {
      param = localStorage.getItem(paramName)
    }
    param = param || paramConfig.default
    if (param === undefined && paramConfig.required) {
      throw new Error(`${paramName} is a required parameter in ${config.tagName}`)
    }
    const type = paramConfig.type
    if (state[paramName] !== param) {
      if (type === 'number') {
        param = Number(param)
      } else if (type === 'boolean') {
        param = Boolean(param)
      } else if (type === 'date') {
        param = new Date(param)
      }
      state[paramName] = param
    }
    if (params[paramName] !== param) {
      params[paramName] = param
      paramsChanged = true
    }
    if (paramConfig.url) {
      urlParams[paramName] = param
    }
  }
  if (paramsChanged) {
    updateHistory(false)
  }
  if (config.signal) {
    config.signal.unqueue()
  }
}

function syncParamsWithState (state, config) {
  const params = history.state.params
  const paramsConfig = config.params
  let historyChanged = false
  let paramsChanged = false

  for (let paramName in paramsConfig) {
    const paramConfig = paramsConfig[paramName]
    const param = state[paramName]

    if (params[paramName] !== param) {
      if (paramConfig.readOnly) {
        throw new Error(`${paramName} is readOnly, but it was set from ${params[paramName]} to ${param} in ${config.tagName}`)
      }
      params[paramName] = param
      paramsChanged = true
      historyChanged = historyChanged || paramConfig.history
    }
    if (paramConfig.durable) {
      localStorage.setItem(paramName, param)
    }
  }
  if (paramsChanged) {
    updateHistory(historyChanged)
  }
}

function syncUrlWithParams () {
  const url = location.pathname + util.toQuery(urlParams)
  history.replaceState(history.state, '', url)
}

function updateHistory (historyChanged) {
  util.updateState(history.state, '', location.pathname, historyChanged)
  document.dispatchEvent(new CustomEvent('params', paramsEventConfig))
}
