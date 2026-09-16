import type { Article } from '../../lib/content/schema'
import { importPages } from './import-pages'

export const importArticles = importPages<Article>
