'use strict'

const util = require('@nx-js/router-util')

const symbols = {
  config: Symbol('params sync config')
}
const watchedParams = new Map()
const paramsEventConfig = {bubbles: true, cancelable: true}

window.addEventListener('popstate', onPopState, true)
window.addEventListener('params', onParams, true)

function onPopState (ev) {
  // ugly timing hack, needed to run params after routing and cleanup is finished
  Promise.resolve().then().then(dispatchParamsEvent)
}

function onParams () {
  watchedParams.forEach(syncStateWithParams)
}


module.exports = function paramsFactory (config) {
  config = config || {}

  function params (node, state) {
    node[symbols.config] = config
    watchedParams.set(config, state)
    node.$cleanup(unwatch, config)

    syncStateWithParams(state, config)
    node.$observe(syncParamsWithState, state, config)
  }
  params.$name = 'params'
  params.$require = ['observe']
  return params
}

function unwatch (config) {
  watchedParams.delete(config)
}

function syncStateWithParams (state, config) {
  const params = history.state.params

  for (let paramName in config) {
    const param = params[paramName] || config[paramName].default
    if (config[paramName].required && param === undefined) {
      throw new Error(`${paramName} is a required parameter`)
    }
    const type = config[paramName].type
    if (state[paramName] !== param) {
      if (param === undefined) {
        state[paramName] = undefined
      } else if (type === 'number') {
        state[paramName] = Number(param)
      } else if (type === 'boolean') {
        state[paramName] = Boolean(param)
      } else if (type === 'date') {
        state[paramName] = new Date(param)
      } else {
        state[paramName] = param
      }
    }
  }
}

function syncParamsWithState (state, config) {
  const params = history.state.params
  let newParams = {}
  let paramsChanged = false
  let historyChanged = false

  for (let paramName in config) {
    if (params[paramName] !== state[paramName]) {
      if (config[paramName].readOnly) {
        throw new Error(`${paramName} is readOnly`)
      }
      newParams[paramName] = state[paramName]
      paramsChanged = true
      if (config[paramName].history) {
        historyChanged = true
      }
    }
  }
  if (paramsChanged) {
    updateHistory(newParams, historyChanged)
  }
}

function updateHistory (params, historyChanged) {
  params = Object.assign({}, history.state.params, params)
  const url = location.pathname + util.toQuery(params)
  util.updateState({route: history.state.route, params}, '', url, historyChanged)
  dispatchParamsEvent()
}

function dispatchParamsEvent () {
  document.dispatchEvent(new CustomEvent('params', paramsEventConfig))
}
