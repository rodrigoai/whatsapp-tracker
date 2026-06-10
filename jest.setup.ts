import '@testing-library/jest-dom'

const { TextDecoder, TextEncoder } = require('util') as typeof import('util')
const { ReadableStream, TransformStream } = require('stream/web') as typeof import('stream/web')
class TestMessagePort {
  onmessage: ((event: { data: unknown }) => void) | null = null
  peer: TestMessagePort | null = null

  postMessage(data: unknown) {
    queueMicrotask(() => this.peer?.onmessage?.({ data }))
  }

  start() {}
  close() {}
}
class TestMessageChannel {
  port1 = new TestMessagePort()
  port2 = new TestMessagePort()

  constructor() {
    this.port1.peer = this.port2
    this.port2.peer = this.port1
  }
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
