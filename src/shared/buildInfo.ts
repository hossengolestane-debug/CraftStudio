export const APP_VERSION = '1.0.7'

export interface AppBuildInfo {
  version: string
  buildTime: string
  commit: string
}

declare const __CS_BUILD_INFO__: AppBuildInfo | undefined

export function getStaticBuildInfo(): AppBuildInfo {
  if (typeof __CS_BUILD_INFO__ !== 'undefined' && __CS_BUILD_INFO__) {
    return __CS_BUILD_INFO__
  }
  return {
    version: APP_VERSION,
    buildTime: 'unspecified (not a packaged electron-vite build)',
    commit: 'unknown'
  }
}

export function formatBuildInfo(info: AppBuildInfo): string {
  return `CraftStudio Local ${info.version} · built ${info.buildTime} · ${info.commit}`
}
