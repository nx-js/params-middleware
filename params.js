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

  function params (node, state, next) {
    const config = node[symbols.config] = {
      scope: node.getAttribute('is') || node.tagName,
      params: paramsConfig,
      node
    }
    watchedParams.set(config, state)
    node.$cleanup(unwatch, config)

    syncStateWithParams(state, config)
    syncUrlWithParams()
    next()
    config.signal = node.$observe(syncParamsWithState, state, config)
  }
  params.$name = 'params'
  params.$require = ['observe']
  return params
}

function unwatch (config) {
  watchedParams.delete(config)
}

function syncStateWithParams (state, config) {
  if (!document.documentElement.contains(config.node)) {
    return
  }
  const params = history.state.params
  const paramsConfig = config.params
  let paramsChanged = false

  for (let paramName in paramsConfig) {
    let param = params[paramName]
    const paramConfig = paramsConfig[paramName]

    if (param === undefined && paramConfig.durable) {
      param = localStorage.getItem(`${config.scope}-${paramName}`)
    }
    param = param || paramConfig.default
    if (param === undefined && paramConfig.required) {
      throw new Error(`${paramName} is a required parameter in ${config.scope}`)
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
        throw new Error(`${paramName} is readOnly, but it was set from ${params[paramName]} to ${param} in ${config.scope}`)
      }
      params[paramName] = param
      paramsChanged = true
      historyChanged = historyChanged || paramConfig.history
    }
    if (paramConfig.durable) {
      localStorage.setItem(`${config.scope}-${paramName}`, param)
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
