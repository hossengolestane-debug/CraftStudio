import { mojangBlockSound, yarnBlockSound } from '../../../shared/blocks'
import type { ProjectSpec, SpecBlock } from '../../../shared/spec'
import { toConstName, VANILLA_ITEMS } from '../../../shared/spec'
import type { PlannedFile } from '../types'

export function blockField(id: string): string {
  return `${toConstName(id)}_BLOCK`
}

export function blockItemField(id: string): string {
  return `${toConstName(id)}_BLOCK_ITEM`
}

export function resolveBlockDropName(spec: ProjectSpec, block: SpecBlock): string {
  if (block.dropItem === 'self') {
    return `${spec.modId}:${block.id}`
  }
  if (block.dropItem.startsWith('minecraft:')) {
    return block.dropItem
  }
  return `${spec.modId}:${block.dropItem}`
}

export function blockStateJson(modId: string, block: SpecBlock): string {
  return `${JSON.stringify({ variants: { '': { model: `${modId}:block/${block.id}` } } }, null, 2)}\n`
}

export function blockModelJson(modId: string, block: SpecBlock, painted: boolean): string {
  return `${JSON.stringify(
    {
      parent: 'minecraft:block/cube_all',
      textures: {
        all: painted ? `${modId}:block/${block.id}` : 'minecraft:block/stone'
      }
    },
    null,
    2
  )}\n`
}

export function blockItemModelJson(modId: string, block: SpecBlock): string {
  return `${JSON.stringify({ parent: `${modId}:block/${block.id}` }, null, 2)}\n`
}

export function blockLootJson(spec: ProjectSpec, block: SpecBlock): string {
  return `${JSON.stringify(
    {
      type: 'minecraft:block',
      pools: [
        {
          rolls: 1.0,
          entries: [
            {
              type: 'minecraft:item',
              name: resolveBlockDropName(spec, block)
            }
          ],
          conditions: [{ condition: 'minecraft:survives_explosion' }]
        }
      ]
    },
    null,
    2
  )}\n`
}

export function planBlockAssetFiles(spec: ProjectSpec): PlannedFile[] {
  return spec.blocks.flatMap((block) => [
    {
      relativePath: `src/main/resources/assets/${spec.modId}/blockstates/${block.id}.json`,
      encoding: 'utf8' as const,
      contents: blockStateJson(spec.modId, block)
    },
    {
      relativePath: `src/main/resources/assets/${spec.modId}/models/block/${block.id}.json`,
      encoding: 'utf8' as const,
      contents: blockModelJson(spec.modId, block, false)
    },
    {
      relativePath: `src/main/resources/assets/${spec.modId}/models/item/${block.id}.json`,
      encoding: 'utf8' as const,
      contents: blockItemModelJson(spec.modId, block)
    },
    {
      relativePath: `src/main/resources/data/${spec.modId}/loot_table/blocks/${block.id}.json`,
      encoding: 'utf8' as const,
      contents: blockLootJson(spec, block)
    }
  ])
}

export function planBlockDocs(spec: ProjectSpec, platform: 'fabric' | 'forge' | 'neoforge' | 'plugin'): PlannedFile[] {
  if (spec.blocks.length === 0 && platform !== 'plugin') {
    return []
  }
  if (platform === 'plugin' && spec.blocks.length === 0 && !spec.unsupportedRequests.some((item) => item.feature === 'custom blocks')) {
    return []
  }
  const rows = spec.blocks
    .map(
      (block) =>
        `- ${block.id}: ${block.material} hardness=${block.hardness} resistance=${block.resistance} drop=${block.dropItem}`
    )
    .join('\n')
  const contents =
    platform === 'plugin'
      ? [
          '# Custom blocks (unsupported on plugins)',
          '',
          'Paper and Spigot cannot register a new block id or blockstate.',
          'CraftStudio will not emit fake block JSON or disguise a vanilla block as a new type.',
          'Use Fabric / Forge / NeoForge for custom blocks.',
          ''
        ].join('\n')
      : [
          '# Custom blocks',
          '',
          `${platform} registers cube_all blocks with a BlockItem, blockstate, model, and block loot table.`,
          'Paint a texture in Assets to replace the stone fallback. This is not a multipart blockstate or inventory API.',
          rows || '- No custom blocks in this spec.',
          ''
        ].join('\n')
  return [{ relativePath: 'BLOCKS.md', encoding: 'utf8', contents }]
}

export function fabricBlockFields(spec: ProjectSpec, classic: boolean): string {
  return spec.blocks
    .map((block) => {
      const sound = yarnBlockSound(block.material)
      if (classic) {
        return `  public static final Block ${blockField(block.id)} = Registry.register(
    Registries.BLOCK,
    Identifier.of(MOD_ID, "${block.id}"),
    new Block(AbstractBlock.Settings.create().strength(${block.hardness}f, ${block.resistance}f).sounds(BlockSoundGroup.${sound}))
  );

  public static final Item ${blockItemField(block.id)} = Registry.register(
    Registries.ITEM,
    Identifier.of(MOD_ID, "${block.id}"),
    new BlockItem(${blockField(block.id)}, new Item.Settings())
  );`
      }
      return `  public static final RegistryKey<Block> ${blockField(block.id)}_KEY = RegistryKey.of(
    RegistryKeys.BLOCK,
    Identifier.of(MOD_ID, "${block.id}")
  );
  public static final RegistryKey<Item> ${blockItemField(block.id)}_KEY = RegistryKey.of(
    RegistryKeys.ITEM,
    Identifier.of(MOD_ID, "${block.id}")
  );
  public static final Block ${blockField(block.id)} = Registry.register(
    Registries.BLOCK,
    ${blockField(block.id)}_KEY,
    new Block(AbstractBlock.Settings.create().registryKey(${blockField(block.id)}_KEY).strength(${block.hardness}f, ${block.resistance}f).sounds(BlockSoundGroup.${sound}))
  );
  public static final Item ${blockItemField(block.id)} = Registry.register(
    Registries.ITEM,
    ${blockItemField(block.id)}_KEY,
    new BlockItem(${blockField(block.id)}, new Item.Settings().registryKey(${blockItemField(block.id)}_KEY))
  );`
    })
    .join('\n\n')
}

export function fabricBlockCreativeAdds(spec: ProjectSpec): string {
  return spec.blocks.map((block) => `      entries.add(${blockItemField(block.id)});`).join('\n')
}

export function forgeBlockRegs(spec: ProjectSpec): string {
  return spec.blocks
    .map((block) => {
      const sound = mojangBlockSound(block.material)
      return `  public static final RegistryObject<Block> ${blockField(block.id)} = BLOCKS.register("${block.id}",
    () -> new Block(BlockBehaviour.Properties.of().strength(${block.hardness}f, ${block.resistance}f).sound(SoundType.${sound})));

  public static final RegistryObject<Item> ${blockItemField(block.id)} = ITEMS.register("${block.id}",
    () -> new BlockItem(${blockField(block.id)}.get(), new Item.Properties()));`
    })
    .join('\n\n')
}

export function forgeBlockCreative(spec: ProjectSpec): string {
  return spec.blocks.map((block) => `      event.accept(${blockItemField(block.id)});`).join('\n')
}

export function neoBlockRegs(spec: ProjectSpec): string {
  return spec.blocks
    .map((block) => {
      const sound = mojangBlockSound(block.material)
      return `  public static final DeferredBlock<Block> ${blockField(block.id)} = BLOCKS.register(
    "${block.id}",
    () -> new Block(BlockBehaviour.Properties.of().strength(${block.hardness}f, ${block.resistance}f).sound(SoundType.${sound}))
  );
  public static final DeferredItem<BlockItem> ${blockItemField(block.id)} = ITEMS.registerSimpleBlockItem(${blockField(block.id)});`
    })
    .join('\n\n')
}

export function itemEntryExpr(spec: ProjectSpec, itemId: string, flavor: 'fabric' | 'forge' | 'neoforge'): string {
  if (itemId.startsWith('minecraft:')) {
    const name = itemId.slice('minecraft:'.length)
    if (flavor === 'fabric') {
      return `Items.${name.toUpperCase()}`
    }
    return `Items.${name.toUpperCase()}`
  }
  const item = spec.items.find((entry) => entry.id === itemId)
  if (item) {
    return flavor === 'fabric' ? toConstName(item.id) : `${toConstName(item.id)}${flavor === 'forge' || flavor === 'neoforge' ? '.get()' : ''}`
  }
  const block = spec.blocks.find((entry) => entry.id === itemId)
  if (block) {
    return flavor === 'fabric' ? blockItemField(block.id) : `${blockItemField(block.id)}.get()`
  }
  return flavor === 'fabric' ? toConstName(spec.items[0]!.id) : `${toConstName(spec.items[0]!.id)}.get()`
}

export function vanillaItemsUsed(ids: string[]): boolean {
  return ids.some((id) => id.startsWith('minecraft:') && VANILLA_ITEMS.includes(id as (typeof VANILLA_ITEMS)[number]))
}
