'use strict'

const secret = {
  config: Symbol('params sync config'),
  initSynced: Symbol('node initial synced')
}
const watchedNodes = new Set()

window.addEventListener('popstate', onPopState)

function onPopState (ev) {
  for (let node of watchedNodes) {
    if (document.body.contains(node)) { // TODO -> refine this a bit! I need a better check
      syncStateWithParams(node)
      syncParamsWithState(node, false)
    }
  }
}

module.exports = function paramsFactory (config) {
  function params (node, state, next) {
    node[secret.config] = config
    watchedNodes.add(node)
    node.$cleanup(unwatch)

    syncStateWithParams(node)
    next()
    syncParamsWithState(node, false)
    node.$observe(syncParamsWithState, node, true)
  }
  params.$name = 'params'
  params.$require = ['observe']
  return params
}

function unwatch () {
  watchedNodes.delete(this)
}

function syncStateWithParams (node) {
  const params = history.state.params
  const state = node.$state
  const config = node[secret.config]

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
      } else if (type === 'string') {
        state[paramName] = String(param)
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

function syncParamsWithState (node, shouldUpdateHistory) {
  const params = history.state.params
  const state = node.$state
  const config = node[secret.config]
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
      if (config[paramName].history && shouldUpdateHistory) {
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

  const url = location.pathname + paramsToQuery(params)
  if (historyChanged) {
    history.pushState({route: history.state.route, params}, '', url)
  } else {
    history.replaceState({route: history.state.route, params}, '', url)
  }
}

function paramsToQuery (params) {
  let query = ''
  for (let paramName in params) {
    const param = params[paramName]
    if (param !== undefined) {
      query += `${paramName}=${param}&`
    }
  }
  if (query !== '') {
    query = '?' + query.slice(0, -1)
  }
  return query
}
