import '@testing-library/jest-dom'

const { TextDecoder, TextEncoder } = require('util') as typeof import('util')
const { ReadableStream, TransformStream } = require('stream/web') as typeof import('stream/web')
class TestMessagePort {}
class TestMessageChannel {
  port1 = new TestMessagePort()
  port2 = new TestMessagePort()
}
Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  TransformStream,
  MessageChannel: TestMessageChannel,
  MessagePort: TestMessagePort,
})

const { Headers, Request, Response } = require('undici') as typeof import('undici')

Object.assign(globalThis, {
  Headers,
  Request,
  Response,
})
