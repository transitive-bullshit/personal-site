import { loadEnv, readSnapshot, publishSnapshot } from './io'
import { download, processMedia, MEDIA_PIPELINE_VERSION } from './media/process'
import { hashBytes, MediaStorage, storageConfig } from './media/storage'

// Upgrade saved videos without fetching Notion or changing publication state.
await loadEnv()
const snapshot = await readSnapshot()
if (!snapshot) throw new Error('No content snapshot found')
const storage = new MediaStorage(storageConfig())
for (const media of Object.values(snapshot.media)) {
  if (!media.original.mime.startsWith('video/')) continue
  if (
    media.pipelineVersion === MEDIA_PIPELINE_VERSION &&
    media.poster &&
    media.original.width &&
    media.original.height
  )
    continue
  const { bytes } = await download(media.original.url)
  if (hashBytes(bytes) !== media.original.hash)
    throw new Error('Saved video hash mismatch: ' + media.source.key)
  const processed = await processMedia(bytes, media.original.mime, storage)
  Object.assign(media, processed, { pipelineVersion: MEDIA_PIPELINE_VERSION })
  await publishSnapshot(snapshot)
  console.info('Updated video ' + media.source.key)
}
