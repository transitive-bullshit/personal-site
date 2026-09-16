import config from '@fisch0920/config/oxfmt'

export default {
  ...config,
  ignorePatterns: [
    ...(config.ignorePatterns ?? []),
    'content/snapshot.json',
    'public/search-index.json'
  ]
}
