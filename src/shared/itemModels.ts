import type { SpecItem } from './spec'

export function itemModelObject(namespace: string, item: SpecItem): Record<string, unknown> {
  const textures: Record<string, string> = {
    layer0: `${namespace}:item/${item.id}`
  }
  if (item.layer1) {
    textures.layer1 = `${namespace}:item/${item.id}_layer1`
  }
  return {
    parent: item.modelStyle === 'handheld' ? 'minecraft:item/handheld' : 'minecraft:item/generated',
    textures
  }
}

export function itemModelJson(namespace: string, item: SpecItem): string {
  return `${JSON.stringify(itemModelObject(namespace, item), null, 2)}\n`
}
