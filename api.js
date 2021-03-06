/* eslint-disable no-await-in-loop */
const { strict: assert } = require('assert')

const Got = require('got')
const ms = require('ms')

const debug = require('./debug')

const FINISHED = new Set(['FINISHED'])
const RESULTS = new Set(['REVIEW', 'PASSED'])

class API {
  constructor ({ baseUrl, bearerToken } = {}) {
    assert(baseUrl, 'argument property "baseUrl" missing')

    const { get, post } = Got.extend({
      baseUrl,
      followRedirect: false,
      headers: {
        ...(bearerToken ? { authorization: `bearer ${bearerToken}` } : undefined),
        'content-type': 'application/json'
      },
      json: true,
      retry: 0,
      timeout: 10000
    })

    this.get = get
    this.post = post
  }

  async getAllTestModules () {
    const { statusCode, body: response } = await this.get('/api/runner/available')

    assert.equal(statusCode, 200)

    return response
  }

  async createTestPlan ({ planName, configuration, variant } = {}) {
    assert(planName, 'argument property "planName" missing')
    assert(configuration, 'argument property "configuration" missing')

    const { statusCode, body: response } = await this.post('/api/plan', {
      query: {
        planName,
        variant
      },
      body: configuration
    })

    assert.equal(statusCode, 201)

    return response
  }

  async getTestPlan ({ planId } = {}) {
    assert(planId, 'argument property "planId" missing')

    const { statusCode, body: response } = await this.get(`/api/plan/${planId}`)

    assert.equal(statusCode, 200)

    return response
  }

  async createTestFromPlan ({ plan, test } = {}) {
    assert(plan, 'argument property "plan" missing')
    assert(test, 'argument property "test" missing')

    const { statusCode, body: response } = await this.post('/api/runner', {
      query: { test, plan }
    })

    assert.equal(statusCode, 201)

    return response
  }

  async getModuleInfo ({ moduleId } = {}) {
    assert(moduleId, 'argument property "moduleId" missing')

    const { statusCode, body: response } = await this.get(`/api/info/${moduleId}`)

    assert.equal(statusCode, 200)

    return response
  }

  async getTestLog ({ moduleId } = {}) {
    assert(moduleId, 'argument property "moduleId" missing')

    const { statusCode, body: response } = await this.get(`/api/log/${moduleId}`)

    assert.equal(statusCode, 200)

    return response
  }

  async waitForState ({ moduleId, interval = ms('2s'), timeout = ms('4m'), states = FINISHED, results = RESULTS } = {}) {
    const timeoutAt = Date.now() + timeout

    while (Date.now() < timeoutAt) {
      const { status, result } = await this.getModuleInfo({ moduleId })
      debug('module id %s status is %s', moduleId, status)
      if (states.has(status)) {
        if (results.size) {
          if (!status || !result) continue
          if (!results.has(result)) {
            throw new Error(`module id ${moduleId} is ${status} but ${result}`)
          }
        } else {
          if (!status) continue
        }

        return [status, result]
      }

      if (status === 'INTERRUPTED') {
        // debug(await this.getTestLog({ moduleId }))
        throw new Error(`module id ${moduleId} is ${status}`)
      }

      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    debug(`module id ${moduleId} expected state timeout`)
    throw new Error(`Timed out waiting for test module ${moduleId} to be in one of states: ${[...states].join(', ')}`)
  }
}

module.exports = API
