# The params middleware factory

The `params` middleware factory is responsible for automatically synchronizing state properties with query parameters.

- name: params
- direct middleware dependencies: [observe](https://github.com/nx-js/observe-middleware)
- all middleware dependencies: [observe](https://github.com/nx-js/observe-middleware)
- processes: element nodes
- throws on: text nodes
- use as: component middleware
- [docs](http://nx-framework/docs/middlewares/params)

## Installation

`npm install @nx-js/params-middleware`

## Usage

```js
const component = require('@nx-js/core')
const observe = require('@nx-js/observe-middleware')
const params = require('@nx-js/params-middleware')

component()
  .use(observe)
  .use(params({
    paramName: {history: true, type: 'string'}
  }))
  .register('comp-name')
```
