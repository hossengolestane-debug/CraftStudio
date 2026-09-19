import { mojangAttributeName, mojangEquipmentGroup, yarnAttributeName, yarnAttributeSlot } from '../../../shared/itemStats'
import type { SpecItem } from '../../../shared/spec'

export function fabricItemSettings(item: SpecItem, classic: boolean): string {
  const parts: string[] = []
  if (item.durability > 0) {
    parts.push(`.maxDamage(${item.durability})`)
  } else {
    parts.push(`.maxCount(${item.maxCount})`)
  }
  if (item.attributes.length > 0) {
    const adds = item.attributes
      .map((attr, index) => {
        const name = yarnAttributeName(attr.id, classic)
        const slot = yarnAttributeSlot(attr.slot)
        return `        .add(EntityAttributes.${name}, new EntityAttributeModifier(Identifier.of(MOD_ID, "${attr.id}_${index}"), ${attr.amount}d, EntityAttributeModifier.Operation.ADD_VALUE), AttributeModifierSlot.${slot})`
      })
      .join('\n')
    parts.push(`.attributeModifiers(AttributeModifiersComponent.builder()
${adds}
        .build())`)
  }
  return `new Item.Settings()${parts.join('')}`
}

export function mojangItemProperties(item: SpecItem): string {
  const parts: string[] = []
  if (item.durability > 0) {
    parts.push(`.durability(${item.durability})`)
  } else {
    parts.push(`.stacksTo(${item.maxCount})`)
  }
  if (item.attributes.length > 0) {
    const adds = item.attributes
      .map((attr, index) => {
        const name = mojangAttributeName(attr.id)
        const slot = mojangEquipmentGroup(attr.slot)
        return `        .add(Attributes.${name}, new AttributeModifier(ResourceLocation.fromNamespaceAndPath(MOD_ID, "${attr.id}_${index}"), ${attr.amount}d, AttributeModifier.Operation.ADD_VALUE), EquipmentSlotGroup.${slot})`
      })
      .join('\n')
    parts.push(`.attributes(ItemAttributeModifiers.builder()
${adds}
        .build())`)
  }
  return `new Item.Properties()${parts.join('')}`
}

export function fabricNeedsAttributeImports(items: SpecItem[]): boolean {
  return items.some((item) => item.attributes.length > 0)
}

export function mojangNeedsAttributeImports(items: SpecItem[]): boolean {
  return items.some((item) => item.attributes.length > 0)
}
