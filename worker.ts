import { parentPort } from 'node:worker_threads'

import { expose } from 'abslink'
import fromNZB, { type NNTPFile } from 'nzb-file/src'

import type { Pool } from 'nzb-file/src/pool'

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
    console.log(`Worker downloading ${data.size} bytes from offset ${this.offset} using pool size ${this.poolSize}`)

    const slices: Array<Promise<void>> = []
    for (let i = 0; i < this.poolSize; i++) {
      const sliceStart = i * Math.ceil(data.size / this.poolSize)
      const sliceEnd = Math.min(data.size, (i + 1) * Math.ceil(data.size / this.poolSize))
      slices.push((async () => {
        for await (const chunk of data.slice(sliceStart, sliceEnd)) {
          // just consume the data
        }
      })())
    }

    await Promise.all(slices)
  }
}, parentPort!)
