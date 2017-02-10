'use strict'

const util = require('@nx-js/router-util')

const symbols = {
  config: Symbol('params sync config')
}
const watchedParams = new Map()
let urlParams = {}

window.addEventListener('popstate', () => syncStatesWithParams(false))

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

function syncStatesWithParams (historyChanged) {
  const paramsEvent = new CustomEvent('params', {
    bubbles: true,
    cancelable: true,
    detail: {params: history.state.params, history: historyChanged}
  })
  document.dispatchEvent(paramsEvent)

  if (!paramsEvent.defaultPrevented) {
    urlParams = {}
    watchedParams.forEach(syncStateWithParams)
    const url = location.pathname + util.toQuery(urlParams)
    util.updateState(history.state, '', url, historyChanged)
  }
}

function syncUrlWithParams () {
  const url = location.pathname + util.toQuery(urlParams)
  history.replaceState(history.state, '', url)
}

function syncStateWithParams (state, config) {
  if (!document.documentElement.contains(config.elem)) {
    return
  }
  const params = history.state.params
  const paramsConfig = config.params

  for (let paramName in paramsConfig) {
    let param = params[paramName]
    const paramConfig = paramsConfig[paramName]

    if (param === undefined && paramConfig.durable) {
      param = localStorage.getItem(paramName)
    }
    if (param === undefined && paramConfig.required) {
      throw new Error(`${paramName} is a required parameter in ${config.tagName}`)
    }
    if (param === undefined) {
      param = paramConfig.default
    }
    param = convertParam(param, paramConfig.type)
    state[paramName] = param
    if (paramConfig.url) {
      urlParams[paramName] = param
    }
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
    let param = state[paramName]
    let isDefault = false
    if (param === undefined) {
      param = paramConfig.default
      isDefault = true
    }

    if (params[paramName] !== param) {
      if (paramConfig.readOnly && isDefault) {
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
    syncStatesWithParams(historyChanged)
  }
}

function convertParam (param, type) {
  if (param === undefined) {
    return param
  }
  if (type === 'number') {
    return Number(param)
  }
  if (type === 'boolean') {
    return Boolean(param)
  }
  if (type === 'date') {
    return new Date(param)
  }
  return param
}
