import { copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

function copyGradleWrapperPlugin() {
  return {
    name: 'copy-gradle-wrapper',
    closeBundle(): void {
      const dest = resolve('out/main/wrapper')
      mkdirSync(dest, { recursive: true })
      for (const name of ['gradle-wrapper.jar', 'gradlew', 'gradlew.bat']) {
        copyFileSync(resolve('src/main/codegen/fabric/wrapper', name), join(dest, name))
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyGradleWrapperPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
