import { promptLooksTruncated } from './promptPreserve'
import { extractShapedRecipeFromPrompt, recipesMatchRequestedGrid } from './recipeExtract'
import type { ProjectSpec } from './spec'
import { HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS } from './vanillaRegistry'
import {
  reportedMaceEnchantmentsComplete,
  promptRequestsCustomTexture,
  promptRequestsMaceEnchantments
} from './weaponSpec'

export interface ApplyBlocker {
  id: string
  message: string
  action: string
}

export function formatApplyBlockers(blockers: ApplyBlocker[]): string {
  return blockers.map((item) => `${item.message} ${item.action}`).join('\n')
}

export function collectApplyBlockers(
  spec: ProjectSpec,
  options: { textureByteLengths?: Record<string, number> } = {}
): ApplyBlocker[] {
  const blockers: ApplyBlocker[] = []
  const prompt = spec.prompt ?? ''

  if (promptLooksTruncated(prompt)) {
    blockers.push({
      id: 'prompt-truncated',
      message: 'The stored request is truncated (mid-word cut such as IMPLEMENTATION AND VERIFI).',
      action: 'Paste the complete original prompt into Design → Generate and generate again. Do not Apply.'
    })
  }

  const requested = extractShapedRecipeFromPrompt(prompt)
  if (requested && !recipesMatchRequestedGrid(spec.recipes, requested, spec.items[0]?.id)) {
    blockers.push({
      id: 'recipe-mismatch',
      message: 'The shaped recipe does not match the requested ingredient grid.',
      action:
        'Restore pattern AHA / .N. / .S. with A=enchanted_golden_apple, H=heavy_core, N=netherite_ingot, S=netherite_sword. Iron/stick defaults are not accepted.'
    })
  }

  const wantsTexture = promptRequestsCustomTexture(prompt)
  if (wantsTexture) {
    const weaponItems = spec.items.filter((item) => item.weapon)
    const noneStyle = weaponItems.filter((item) => (item.weapon?.textureStyle ?? 'none') === 'none')
    if (noneStyle.length > 0 || weaponItems.length === 0) {
      blockers.push({
        id: 'texture-style-none',
        message: 'A custom texture was requested but textureStyle is "none".',
        action: 'Set textureStyle to netherite_mace (or generic_weapon) so a 32×32 PNG is generated and referenced by the item model.'
      })
    }
    const missing: string[] = []
    for (const item of spec.items) {
      if ((item.weapon?.textureStyle ?? 'none') === 'none') {
        continue
      }
      const bytes = options.textureByteLengths?.[item.id] ?? 0
      if (options.textureByteLengths && bytes <= 0) {
        missing.push(item.id)
      }
    }
    if (missing.length > 0) {
      blockers.push({
        id: 'texture-file-absent',
        message: `Required texture PNG bytes are absent for: ${missing.join(', ')}.`,
        action: 'Generate or import a 32×32 transparent PNG and keep textureStyle off "none" before Apply.'
      })
    }
  }

  if (promptRequestsMaceEnchantments(prompt) && !reportedMaceEnchantmentsComplete(spec)) {
    const list = HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS.map((entry) => `${entry.id} ${entry.level}`).join(', ')
    blockers.push({
      id: 'enchantments-incomplete',
      message: 'Mace enchantment selection is incomplete or unreported.',
      action: `Record the highest mutually compatible 1.21.1 mace set on items[].weapon.enchantments: ${list}. Fire Aspect II alone is not enough.`
    })
  }

  return blockers
}
