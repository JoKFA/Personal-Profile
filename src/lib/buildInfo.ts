declare const __BUILD_COMMIT__: string
declare const __BUILD_DATE__: string

export const buildCommit: string =
  typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev'

export const buildDate: string =
  typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString().slice(0, 10)
