import { validateSnapshot } from '../lib/content/references'
import { readSnapshot } from './io'
import { publishSearchIndex } from './search-index'

const snapshot = await readSnapshot()
if (!snapshot) throw new Error('Sync content before building the search index')
validateSnapshot(snapshot)
const changed = await publishSearchIndex(snapshot)
console.log(changed ? 'Search index updated' : 'Search index unchanged')
