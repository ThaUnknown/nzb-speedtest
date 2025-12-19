import { parentPort } from 'node:worker_threads'

import { expose } from 'abslink'
import fromNZB, { type NNTPFile } from 'nzb-file/src'

import type { Pool } from 'nzb-file/src/pool'

async function * parallel<T> (
  source: AsyncIterable<T>,
  concurrency: number
): AsyncGenerator<T> {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new RangeError('concurrency must be a positive integer')
  }

  const iterator = source[Symbol.asyncIterator]()
  const inFlight = new Set<Promise<IteratorResult<T>>>()
  let reachedDone = false

  const startOne = () => {
    if (reachedDone) return
    const p = iterator.next()
    inFlight.add(p)
    p.finally(() => inFlight.delete(p))
  }

  // prime the pool
  while (inFlight.size < concurrency) startOne()

  while (inFlight.size) {
    const result = await Promise.race(inFlight)

    if (result.done) {
      reachedDone = true
      continue
    }

    yield result.value
    startOne()
  }
}

export default expose(class NZBWorker {
  pool?: Pool
  largestFile?: NNTPFile
  poolSize?: number
  offset
  length

  constructor (offset: number, length: number) {
    this.offset = offset
    this.length = length
  }

  async init (contents: string, domain: string, login: string, password: string, poolSize: number) {
    const { files, pool } = await fromNZB(contents, domain, 119, login, password, 'alt.binaries.multimedia.anime.highspeed', poolSize)

    this.pool = pool
    this.largestFile = files.reduce((a, b) => (a.size > b.size ? a : b))

    await pool.ready

    this.poolSize = pool.pool.size
  }

  destroy () {
    return this.pool?.destroy()
  }

  async makeRequest () {
    if (!this.pool) throw new Error('Worker not initialized')
    if (!this.largestFile) throw new Error('No files available')
    if (!this.poolSize) throw new Error('Pool size unknown')

    const data = this.largestFile.slice(this.offset, this.offset + this.length)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const chunk of parallel(data, this.poolSize)) {
      // :)
    }
  }
}, parentPort!)
