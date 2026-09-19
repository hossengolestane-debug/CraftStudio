import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { GenerationService } from '../src/main/services/generationService'
import { OllamaService } from '../src/main/services/ollamaService'
import { ProjectService } from '../src/main/services/projectService'
import { SettingsService } from '../src/main/services/settingsService'
import { renderWeaponTexture } from '../src/main/codegen/textures/proceduralWeapon'
import { decodePng } from '../src/shared/png'
import { countOpaquePixels } from '../src/shared/pixelSpec'
import { existsSync } from 'node:fs'
import { collectApplyBlockers } from '../src/shared/applyBlockers'
import { FEATURE_PROMPT_MAX, promptLooksTruncated } from '../src/shared/promptPreserve'
import { extractShapedRecipeFromPrompt } from '../src/shared/recipeExtract'
import { assembleGeneratedSpec } from '../src/shared/specMerge'
import { parseProjectSpec } from '../src/shared/spec'
import { inferSpecFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'
import { HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS } from '../src/shared/vanillaRegistry'
import { promptRequestsCustomMob } from '../src/shared/weaponSpec'
import { LEGENDARY_MACE_FIXTURE_SPEC, LEGENDARY_MACE_REQUEST } from './fixtures/legendaryMaceRequest'

const forgeManifest: ProjectManifest = {
  id: 'cccccccc-1111-4222-8333-444444444444',
  name: 'Legendary Mace',
  description: 'Legendary Mace',
  type: 'mod',
  platform: 'forge',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T08:00:00.000Z',
  updatedAt: '2026-09-18T08:00:00.000Z',
  features: {
    customItems: true,
    customMobs: false,
    customGuis: false,
    customBlocks: false,
    recipes: true
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

describe('Legendary Mace acceptance fixture', () => {
  it('extracts the exact shaped recipe and does not invent iron or stick', () => {
    const extracted = extractShapedRecipeFromPrompt(LEGENDARY_MACE_REQUEST)
    expect(extracted?.pattern).toEqual(['AHA', '.N.', '.S.'])
    expect(extracted?.keys).toEqual([
      { symbol: 'A', kind: 'vanilla', id: 'minecraft:enchanted_golden_apple' },
      { symbol: 'H', kind: 'vanilla', id: 'minecraft:heavy_core' },
      { symbol: 'N', kind: 'vanilla', id: 'minecraft:netherite_ingot' },
      { symbol: 'S', kind: 'vanilla', id: 'minecraft:netherite_sword' }
    ])
    expect(extracted?.keys.some((key) => key.id.includes('iron') || key.id.includes('stick'))).toBe(false)
  })

  it('does not treat hostile-mob filtering as a request to create a mob', () => {
    expect(promptRequestsCustomMob(LEGENDARY_MACE_REQUEST)).toBe(false)
    expect(promptRequestsCustomMob('Add a custom mob and a GUI')).toBe(true)
  })

  it('infers a Forge spec that keeps the full request, recipe, and no loot/mob', () => {
    const spec = inferSpecFromPrompt(forgeManifest, LEGENDARY_MACE_REQUEST)
    expect(spec.prompt).toContain('IMPLEMENTATION AND VERIFICATION')
    expect(spec.prompt).not.toMatch(/IMPLEMENTATION AND VERIFI$/)
    expect(spec.mobs).toEqual([])
    expect(spec.config.enableChestLoot).toBe(false)
    expect(spec.config.enableWorldgen).toBe(false)
    expect(spec.recipes[0]?.pattern).toEqual(['AHA', '.N.', '.S.'])
    expect(spec.recipes[0]?.keys.map((key) => key.id)).toEqual([
      'minecraft:enchanted_golden_apple',
      'minecraft:heavy_core',
      'minecraft:netherite_ingot',
      'minecraft:netherite_sword'
    ])
    expect(spec.items[0]?.weapon?.smash).toBe(true)
    expect(spec.items[0]?.weapon?.lifeSteal).toMatchObject({
      enabled: true,
      percent: 0.2,
      capHealth: 4,
      hostileOnly: true
    })
    expect(spec.items[0]?.weapon?.shockwave).toMatchObject({
      enabled: true,
      minFallBlocks: 3,
      cooldownSeconds: 10,
      radius: 6,
      damage: 8,
      upwardImpulse: 1
    })
    expect(spec.items[0]?.weapon?.terrain).toMatchObject({ enabled: true, radius: 3, maxBlocks: 24 })
    expect(spec.items[0]?.weapon?.textureStyle).toBe('netherite_mace')
    expect(spec.items[0]?.weapon?.enchantments).toEqual([...HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS])
    expect(spec.source).toBe('template')
    expect(spec.modGuis).toEqual([])
    expect(spec.pluginGuis).toEqual([])
    expect(spec.worldgen).toEqual([])
    expect(collectApplyBlockers(spec)).toEqual([])
    expect(FEATURE_PROMPT_MAX).toBe(32_000)
    expect(LEGENDARY_MACE_REQUEST.length).toBeLessThan(FEATURE_PROMPT_MAX)
    expect(promptLooksTruncated(spec.prompt)).toBe(false)
  })

  it('does not merge template mobs or iron recipes over model output', () => {
    const assembled = assembleGeneratedSpec({
      identity: {
        modId: 'legendary_mace',
        displayName: 'Legendary Mace',
        packageName: 'local.craftstudio.legendary_mace',
        mainClass: 'LegendaryMace'
      },
      model: {
        items: [{ id: 'legendary_mace', displayName: 'Legendary Mace' }],
        recipes: [
          {
            id: 'wrong',
            type: 'shaped',
            resultItemId: 'legendary_mace',
            pattern: [' I ', ' S ', ' S '],
            keys: [
              { symbol: 'I', kind: 'vanilla', id: 'minecraft:iron_ingot' },
              { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
            ]
          }
        ],
        mobs: [{ id: 'legendary_mace_mob', displayName: 'Legendary Mace Mob' }],
        config: { enableChestLoot: true, enableWorldgen: true },
        source: 'ollama'
      },
      originalPrompt: LEGENDARY_MACE_REQUEST,
      source: 'ollama',
      fallbackItems: [],
      fallbackRecipes: []
    })
    const spec = parseProjectSpec(assembled)
    expect(spec.source).toBe('ollama')
    expect(spec.mobs).toEqual([])
    expect(spec.config.enableChestLoot).toBe(false)
    expect(spec.recipes[0]?.keys.map((key) => key.id)).toEqual([
      'minecraft:enchanted_golden_apple',
      'minecraft:heavy_core',
      'minecraft:netherite_ingot',
      'minecraft:netherite_sword'
    ])
    expect(spec.prompt).toContain('IMPLEMENTATION AND VERIFICATION')
    expect(spec.items[0]?.weapon?.textureStyle).toBe('netherite_mace')
    expect(spec.items[0]?.weapon?.enchantments).toEqual([...HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS])
  })

  it('extracts YAML/JSON quoted pattern rows so the exact grid still wins', () => {
    const yamlPrompt = `pattern:
- "AHA"
- ".N."
- ".S."
keys:
A = minecraft:enchanted_golden_apple
H = minecraft:heavy_core
N = minecraft:netherite_ingot
S = minecraft:netherite_sword
`
    const extracted = extractShapedRecipeFromPrompt(yamlPrompt)
    expect(extracted?.pattern).toEqual(['AHA', '.N.', '.S.'])
    expect(extracted?.keys.map((key) => key.id)).toEqual([
      'minecraft:enchanted_golden_apple',
      'minecraft:heavy_core',
      'minecraft:netherite_ingot',
      'minecraft:netherite_sword'
    ])
  })

  it('merges a partial Ollama weapon so textureStyle none and Fire Aspect II do not win', () => {
    const assembled = assembleGeneratedSpec({
      identity: {
        modId: 'legendary_mace',
        displayName: 'Legendary Mace',
        packageName: 'local.craftstudio.legendary_mace',
        mainClass: 'LegendaryMace'
      },
      model: {
        items: [
          {
            id: 'legendary_mace',
            displayName: 'Legendary Mace',
            weapon: {
              smash: true,
              textureStyle: 'none',
              enchantments: [{ id: 'minecraft:fire_aspect', level: 2 }]
            }
          }
        ],
        recipes: [
          {
            id: 'wrong',
            type: 'shaped',
            resultItemId: 'legendary_mace',
            resultCount: 1,
            pattern: [' I ', ' S ', ' S '],
            keys: [
              { symbol: 'I', kind: 'vanilla', id: 'minecraft:iron_ingot' },
              { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
            ]
          }
        ],
        source: 'ollama'
      },
      originalPrompt: LEGENDARY_MACE_REQUEST,
      source: 'ollama'
    })
    const spec = parseProjectSpec(assembled)
    expect(spec.recipes[0]?.pattern).toEqual(['AHA', '.N.', '.S.'])
    expect(spec.items[0]?.weapon?.textureStyle).toBe('netherite_mace')
    expect(spec.items[0]?.weapon?.enchantments).toEqual([...HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS])
    expect(collectApplyBlockers(spec)).toEqual([])
  })

  it('blocks Apply when recipe, texture, or enchantments are wrong', () => {
    const good = parseProjectSpec(LEGENDARY_MACE_FIXTURE_SPEC)
    expect(collectApplyBlockers(good)).toEqual([])
    const bad = parseProjectSpec({
      ...LEGENDARY_MACE_FIXTURE_SPEC,
      prompt: `${LEGENDARY_MACE_REQUEST.slice(0, LEGENDARY_MACE_REQUEST.indexOf('IMPLEMENTATION AND VERIFI') + 'IMPLEMENTATION AND VERIFI'.length)}`,
      recipes: [
        {
          ...LEGENDARY_MACE_FIXTURE_SPEC.recipes[0],
          pattern: [' X ', ' X ', ' S '],
          keys: [
            { symbol: 'X', kind: 'vanilla', id: 'minecraft:iron_ingot' },
            { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
          ]
        }
      ],
      items: LEGENDARY_MACE_FIXTURE_SPEC.items.map((item) => ({
        ...item,
        weapon: { ...item.weapon, textureStyle: 'none', enchantments: [{ id: 'minecraft:fire_aspect', level: 2 }] }
      }))
    })
    const ids = collectApplyBlockers(bad, { textureByteLengths: { legendary_mace: 0 } }).map((item) => item.id)
    expect(ids).toContain('prompt-truncated')
    expect(ids).toContain('recipe-mismatch')
    expect(ids).toContain('texture-style-none')
    expect(ids).toContain('enchantments-incomplete')
  })

  it('keeps the committed 32×32 PNG fixture bytes on disk', async () => {
    const pngPath = path.join(__dirname, 'fixtures/legendary_mace.png')
    expect(existsSync(pngPath)).toBe(true)
    const bytes = await readFile(pngPath)
    expect(bytes.byteLength).toBeGreaterThan(80)
    const decoded = decodePng(bytes)
    expect(decoded.width).toBe(32)
    expect(decoded.height).toBe(32)
    expect(countOpaquePixels(decoded.pixels)).toBeGreaterThan(20)
  })

  it('keeps the full corrected spec fixture on disk', async () => {
    const specPath = path.join(__dirname, 'fixtures/legendaryMace.craftstudio.spec.json')
    expect(existsSync(specPath)).toBe(true)
    const raw = await readFile(specPath, 'utf8')
    const spec = parseProjectSpec(JSON.parse(raw))
    expect(spec.prompt).toContain('IMPLEMENTATION AND VERIFICATION')
    expect(spec.prompt).not.toMatch(/IMPLEMENTATION AND VERIFI$/)
    expect(spec.recipes[0]?.pattern).toEqual(['AHA', '.N.', '.S.'])
    expect(spec.items[0]?.weapon?.textureStyle).toBe('netherite_mace')
    expect(spec.items[0]?.weapon?.enchantments).toEqual([...HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS])
    expect(spec.mobs).toEqual([])
    expect(spec.config.enableChestLoot).toBe(false)
    expect(spec.config.enableWorldgen).toBe(false)
    expect(spec.modGuis).toEqual([])
    expect(spec.worldgen).toEqual([])
  })

  it('emits Forge Java, exact recipe, procedural texture, and no loot/mob files', () => {
    const spec = parseProjectSpec(LEGENDARY_MACE_FIXTURE_SPEC)
    const files = planForgeFiles(forgeManifest, spec)
    const paths = files.map((file) => file.relativePath)
    expect(paths.some((path) => path.includes('legendary_mace_mob'))).toBe(false)
    expect(paths.some((path) => path.includes('loot_modifiers'))).toBe(false)
    expect(paths.some((path) => path.includes('AddBonusChestModifier'))).toBe(false)
    expect(paths.some((path) => path.endsWith('preset_mob.png'))).toBe(false)

    const recipe =
      files.find((file) => file.relativePath.endsWith('recipe/legendary_mace_shaped.json'))?.contents.toString() ?? ''
    expect(recipe).toContain('minecraft:enchanted_golden_apple')
    expect(recipe).toContain('minecraft:heavy_core')
    expect(recipe).toContain('minecraft:netherite_ingot')
    expect(recipe).toContain('minecraft:netherite_sword')
    expect(recipe).toContain('minecraft:density')
    expect(recipe).toContain('minecraft:wind_burst')
    expect(recipe).toContain('minecraft:fire_aspect')
    expect(recipe).toContain('minecraft:unbreaking')
    expect(recipe).toContain('minecraft:mending')
    expect(recipe).not.toContain('minecraft:breach')
    expect(recipe).not.toContain('minecraft:iron_ingot')
    expect(recipe).not.toContain('minecraft:stick')

    const abilities =
      files.find((file) => file.relativePath.endsWith('CraftStudioWeaponAbilities.java'))?.contents.toString() ?? ''
    expect(abilities).toContain('new WeaponSpec(')
    expect(abilities).toMatch(/6(?:\.0)?d/)
    expect(abilities).toMatch(/8(?:\.0)?f/)
    expect(abilities).toMatch(/1(?:\.0)?d/)
    expect(abilities).toContain('0.2d')
    expect(abilities).toMatch(/4(?:\.0)?f/)

    const events =
      files.find((file) => file.relativePath.endsWith('WeaponAbilityEvents.java'))?.contents.toString() ?? ''
    expect(events).toContain('LivingDamageEvent')
    expect(events).toContain('isShockwaveActive')
    expect(events).toContain('instanceof Enemy')
    expect(events).toContain('enableTerrainDestruction')
    expect(events).toContain('removeBlock(pos, false)')
    expect(events).toContain('MACE_SMASH_GROUND')

    const mace = files.find((file) => file.relativePath.endsWith('CraftStudioMaceItem.java'))?.contents.toString() ?? ''
    expect(mace).toContain('extends MaceItem')
    expect(mace).toContain('hurtEnemy')

    const main = files.find((file) => file.relativePath.endsWith('LegendaryMace.java'))?.contents.toString() ?? ''
    expect(main).toContain('new CraftStudioMaceItem')
    expect(main).not.toContain('ADD_BONUS_CHEST')

    const model =
      files.find((file) => file.relativePath.endsWith('models/item/legendary_mace.json'))?.contents.toString() ?? ''
    expect(model).toContain('minecraft:item/handheld')
    expect(model).toContain('legendary_mace:item/legendary_mace')
    expect(model).not.toContain('textures/entity')

    const config = files.find((file) => file.relativePath.endsWith('CraftStudioConfig.java'))?.contents.toString() ?? ''
    expect(config).toContain('enableTerrainDestruction')
    expect(config).toContain('enableChestLoot = false')
  })

  it('packages a real 32×32 transparent PNG with opaque paint', () => {
    const spec = parseProjectSpec(LEGENDARY_MACE_FIXTURE_SPEC)
    const png = renderWeaponTexture(spec.items[0]!)
    const decoded = decodePng(png)
    expect(decoded.width).toBe(32)
    expect(decoded.height).toBe(32)
    expect(countOpaquePixels(decoded.pixels)).toBeGreaterThan(20)
    let transparent = 0
    for (let i = 3; i < decoded.pixels.length; i += 4) {
      if ((decoded.pixels[i] ?? 0) === 0) {
        transparent += 1
      }
    }
    expect(transparent).toBeGreaterThan(20)
  })

  it('changes only shockwave radius when that field is edited', () => {
    const original = parseProjectSpec(LEGENDARY_MACE_FIXTURE_SPEC)
    const edited = parseProjectSpec({
      ...original,
      source: 'editor',
      items: original.items.map((item) => ({
        ...item,
        weapon: item.weapon
          ? { ...item.weapon, shockwave: { ...item.weapon.shockwave!, radius: 8 } }
          : item.weapon
      }))
    })
    const before = planForgeFiles(forgeManifest, original)
    const after = planForgeFiles(forgeManifest, edited)
    const beforeRecipe =
      before.find((file) => file.relativePath.endsWith('recipe/legendary_mace_shaped.json'))?.contents.toString() ?? ''
    const afterRecipe =
      after.find((file) => file.relativePath.endsWith('recipe/legendary_mace_shaped.json'))?.contents.toString() ?? ''
    expect(afterRecipe).toBe(beforeRecipe)
    const beforeLife =
      before.find((file) => file.relativePath.endsWith('CraftStudioWeaponAbilities.java'))?.contents.toString() ?? ''
    const afterLife =
      after.find((file) => file.relativePath.endsWith('CraftStudioWeaponAbilities.java'))?.contents.toString() ?? ''
    expect(beforeLife).toMatch(/6(?:\.0)?d/)
    expect(afterLife).toMatch(/8(?:\.0)?d/)
    expect(afterLife).toContain('0.2d')
    expect(afterLife).toMatch(/4(?:\.0)?f/)
    expect(afterLife.replace('8.0d', '6.0d').replace('8d', '6d')).toBe(beforeLife)
    const beforeTex = renderWeaponTexture(original.items[0]!)
    const afterTex = renderWeaponTexture(edited.items[0]!)
    expect(Buffer.compare(beforeTex, afterTex)).toBe(0)
  })

  it('drives the app generate/apply path with the Legendary Mace fixture (template; Ollama NOT RUN)', async () => {
    const temps: string[] = []
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-mace-settings-'))
    const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'cs-mace-projects-'))
    temps.push(userData, projectsRoot)
    try {
      const settings = new SettingsService({ userDataPath: userData })
      await settings.update({ projectsPath: projectsRoot })
      const projects = new ProjectService(settings, () => new Date('2026-09-18T18:00:00.000Z'))
      const generation = new GenerationService(projects, settings, new OllamaService())
      const created = await projects.create({
        name: 'Legendary Mace',
        description: LEGENDARY_MACE_REQUEST,
        type: 'mod',
        platform: 'forge',
        minecraftVersion: '1.21.1'
      })
      const result = await generation.generateSpec(created.manifest.id, LEGENDARY_MACE_REQUEST, 'template')
      expect(result.usedOllama).toBe(false)
      expect(result.spec.prompt).toContain('IMPLEMENTATION AND VERIFICATION')
      expect(result.spec.mobs).toEqual([])
      expect(result.spec.config.enableChestLoot).toBe(false)
      expect(result.spec.items[0]?.weapon?.textureStyle).toBe('netherite_mace')
      expect(result.spec.items[0]?.weapon?.enchantments).toEqual([...HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS])
      const preview = await generation.previewApply(created.manifest.id, result.spec)
      expect(preview.overwriteCount).toBeGreaterThanOrEqual(0)
      expect(preview.applyBlockers).toEqual([])
      const applied = await generation.applySpec(created.manifest.id, result.spec, true)
      expect(applied.applied).toBe(true)
      const texture = await readFile(
        path.join(
          created.directoryPath,
          'src/main/resources/assets/legendary_mace/textures/item/legendary_mace.png'
        )
      )
      expect(texture.byteLength).toBeGreaterThan(80)
      const recipe = await readFile(
        path.join(created.directoryPath, 'src/main/resources/data/legendary_mace/recipe/legendary_mace_shaped.json'),
        'utf8'
      )
      expect(recipe).toContain('minecraft:heavy_core')
      expect(recipe).not.toContain('iron_ingot')
      const abilities = await readFile(
        path.join(
          created.directoryPath,
          'src/main/java/local/craftstudio/legendary_mace/CraftStudioMaceItem.java'
        ),
        'utf8'
      )
      expect(abilities).toContain('extends MaceItem')
    } finally {
      await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })))
    }
  })

  it('rejects unknown ingredients without substituting defaults', () => {
    expect(() =>
      parseProjectSpec({
        ...LEGENDARY_MACE_FIXTURE_SPEC,
        recipes: [
          {
            ...LEGENDARY_MACE_FIXTURE_SPEC.recipes[0],
            keys: [
              { symbol: 'A', kind: 'vanilla', id: 'minecraft:not_a_real_item_xyz' },
              { symbol: 'H', kind: 'vanilla', id: 'minecraft:heavy_core' },
              { symbol: 'N', kind: 'vanilla', id: 'minecraft:netherite_ingot' },
              { symbol: 'S', kind: 'vanilla', id: 'minecraft:netherite_sword' }
            ]
          }
        ]
      })
    ).toThrow(/not_a_real_item_xyz/)
    try {
      parseProjectSpec({
        ...LEGENDARY_MACE_FIXTURE_SPEC,
        recipes: [
          {
            ...LEGENDARY_MACE_FIXTURE_SPEC.recipes[0],
            keys: [
              { symbol: 'A', kind: 'vanilla', id: 'minecraft:not_a_real_item_xyz' },
              { symbol: 'H', kind: 'vanilla', id: 'minecraft:heavy_core' },
              { symbol: 'N', kind: 'vanilla', id: 'minecraft:netherite_ingot' },
              { symbol: 'S', kind: 'vanilla', id: 'minecraft:netherite_sword' }
            ]
          }
        ]
      })
    } catch (error) {
      expect(String(error)).not.toMatch(/iron_ingot|replaced/)
    }
  })
})
