import { readFile } from 'node:fs/promises'
import { argv } from 'node:process'
import { Worker } from 'node:worker_threads'

import { wrap } from 'abslink'
import parse from 'nzb-parser'

import type NZBWorker from './worker.ts'
import type { Remote } from 'abslink'

try {
  const settings = (await import('./settings.json', { with: { type: 'json' } })).default
  console.log('starting client with settings', settings)

  const nzbFile = argv[2]

  if (!nzbFile) {
    throw new Error('No NZB file provided. Usage: node index.ts <path-to-nzb-file>')
  }

  const nzbcontents = await readFile(nzbFile, 'utf-8')

  const { files } = parse(nzbcontents)

  const largestFile = files.reduce((a, b) => (a.size > b.size ? a : b))

  const workers: Array<Remote<InstanceType<typeof NZBWorker>>> = []

  for (const config of settings) {
    const batchSize = Math.ceil(largestFile.size / config.threads)
    for (let i = 0; i < config.threads; i++) {
      const batchOffset = i * batchSize
      const worker = new Worker(new URL('./worker.ts', import.meta.url))

      const nzbWorker = await new (wrap<typeof NZBWorker>(worker))(batchOffset, batchSize)
      await nzbWorker.init(nzbcontents, config.domain, config.login, config.password, config.connectionsPerThread)
      workers.push(nzbWorker)
    }
  }
  console.log(`Started ${workers.length} workers to download ${largestFile.name} (${(largestFile.size / (1024 * 1024)).toFixed(2)} MB)`)

  const startTime = Date.now()
  await Promise.all(workers.map(worker => worker.makeRequest()))
  const endTime = Date.now()

  const durationSeconds = (endTime - startTime) / 1000
  const speedMbps = (largestFile.size * 8) / (durationSeconds * 1024 * 1024)
  console.log(`Download completed in ${durationSeconds.toFixed(2)} seconds at an average speed of ${speedMbps.toFixed(2)} Mbps`)
} catch (err) {
  console.error('failed to start nzb client', err)
}
