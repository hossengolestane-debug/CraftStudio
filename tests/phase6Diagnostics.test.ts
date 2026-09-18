import { describe, expect, it } from 'vitest'
import { diagnoseBuildLogs } from '../src/shared/buildDiagnostics'
import { applyKnownTemplateRepairs } from '../src/main/services/repairService'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { texturePngPath } from '../src/main/services/textureService'

describe('Phase 6 diagnostics, repair, and layer1 paths', () => {
  it('maps JDK, offline, and FeatureFlags failures to actionable diagnostics', () => {
    const jdk = diagnoseBuildLogs('Unable to locate a Java Runtime', false)
    expect(jdk.some((item) => item.id === 'jdk-missing')).toBe(true)

    const offline = diagnoseBuildLogs('Could not resolve net.neoforged:moddev\nUnknown host maven.neoforged.net', true)
    expect(offline.some((item) => item.id === 'offline-deps')).toBe(true)
    expect(offline.find((item) => item.id === 'offline-deps')?.action).toMatch(/cache/)

    const flags = diagnoseBuildLogs('incompatible types: FeatureFlag cannot be converted to FeatureSet', true)
    expect(flags[0]?.repairId).toBe('featureflags-vanilla-features')
  })

  it('repairs FeatureFlags.VANILLA on allowlisted Java only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cs-repair-'))
    const project = 'demo-aaaaaaaa'
    const javaRel = 'src/main/java/local/demo/Main.java'
    await mkdir(path.join(root, project, 'src/main/java/local/demo'), { recursive: true })
    await writeFile(
      path.join(root, project, javaRel),
      'new ScreenHandlerType<>(ExampleScreenHandler::new, FeatureFlags.VANILLA);\n',
      'utf8'
    )
    const result = await applyKnownTemplateRepairs(
      root,
      project,
      'incompatible types: FeatureFlag cannot be converted to FeatureSet',
      true
    )
    expect(result.attempted).toBe(true)
    expect(result.filesChanged).toContain(javaRel)
    const { readFile } = await import('node:fs/promises')
    const after = await readFile(path.join(root, project, javaRel), 'utf8')
    expect(after).toContain('FeatureFlags.VANILLA_FEATURES')
    expect(after).not.toMatch(/FeatureFlags\.VANILLA\)/)
  })

  it('keeps layer1 textures on the allowlisted craftstudio/textures prefix', () => {
    expect(texturePngPath('harbor_token', 'layer1')).toBe('craftstudio/textures/harbor_token_layer1.png')
    expect(texturePngPath('harbor_token', 'layer0')).toBe('craftstudio/textures/harbor_token.png')
  })
})
