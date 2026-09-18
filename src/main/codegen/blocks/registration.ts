import { derivedBlockIds, mojangBlockSound, slabId, stairsId, yarnBlockSound } from '../../../shared/blocks'
import type { ProjectSpec, SpecBlock } from '../../../shared/spec'
import { toConstName, VANILLA_ITEMS } from '../../../shared/spec'
import type { PlannedFile } from '../types'

export function blockField(id: string): string {
  return `${toConstName(id)}_BLOCK`
}

export function blockItemField(id: string): string {
  return `${toConstName(id)}_BLOCK_ITEM`
}

export function resolveBlockDropName(spec: ProjectSpec, block: SpecBlock, variantId = block.id): string {
  if (block.dropItem === 'self') {
    return `${spec.modId}:${variantId}`
  }
  if (block.dropItem.startsWith('minecraft:')) {
    return block.dropItem
  }
  return `${spec.modId}:${block.dropItem}`
}

function textureId(modId: string, block: SpecBlock, painted: boolean): string {
  return painted ? `${modId}:block/${block.id}` : 'minecraft:block/stone'
}

export function blockStateJson(modId: string, block: SpecBlock): string {
  if (block.shape === 'pillar') {
    return `${JSON.stringify(
      {
        variants: {
          'axis=y': { model: `${modId}:block/${block.id}` },
          'axis=z': { model: `${modId}:block/${block.id}`, x: 90 },
          'axis=x': { model: `${modId}:block/${block.id}`, x: 90, y: 90 }
        }
      },
      null,
      2
    )}\n`
  }
  return `${JSON.stringify({ variants: { '': { model: `${modId}:block/${block.id}` } } }, null, 2)}\n`
}

export function slabBlockStateJson(modId: string, block: SpecBlock): string {
  const id = slabId(block.id)
  return `${JSON.stringify(
    {
      variants: {
        'type=bottom': { model: `${modId}:block/${id}` },
        'type=top': { model: `${modId}:block/${id}_top` },
        'type=double': { model: `${modId}:block/${block.id}` }
      }
    },
    null,
    2
  )}\n`
}

export function stairsBlockStateJson(modId: string, block: SpecBlock): string {
  const model = `${modId}:block/${stairsId(block.id)}`
  const inner = `${model}_inner`
  const outer = `${model}_outer`
  const variants: Record<string, { model: string; x?: number; y?: number; uvlock?: boolean }> = {}
  const facings = ['east', 'west', 'south', 'north'] as const
  const yRot: Record<(typeof facings)[number], number> = { east: 0, west: 180, south: 90, north: 270 }
  for (const facing of facings) {
    const y = yRot[facing]
    variants[`facing=${facing},half=bottom,shape=straight`] = { model, y, uvlock: true }
    variants[`facing=${facing},half=bottom,shape=inner_left`] = { model: inner, y: (y + 270) % 360, uvlock: true }
    variants[`facing=${facing},half=bottom,shape=inner_right`] = { model: inner, y, uvlock: true }
    variants[`facing=${facing},half=bottom,shape=outer_left`] = { model: outer, y: (y + 270) % 360, uvlock: true }
    variants[`facing=${facing},half=bottom,shape=outer_right`] = { model: outer, y, uvlock: true }
    variants[`facing=${facing},half=top,shape=straight`] = { model, x: 180, y, uvlock: true }
    variants[`facing=${facing},half=top,shape=inner_left`] = { model: inner, x: 180, y: (y + 270) % 360, uvlock: true }
    variants[`facing=${facing},half=top,shape=inner_right`] = { model: inner, x: 180, y: (y + 180) % 360, uvlock: true }
    variants[`facing=${facing},half=top,shape=outer_left`] = { model: outer, x: 180, y: (y + 270) % 360, uvlock: true }
    variants[`facing=${facing},half=top,shape=outer_right`] = { model: outer, x: 180, y: (y + 180) % 360, uvlock: true }
  }
  return `${JSON.stringify({ variants }, null, 2)}\n`
}

export function blockModelJson(modId: string, block: SpecBlock, painted: boolean): string {
  const tex = textureId(modId, block, painted)
  if (block.shape === 'pillar') {
    return `${JSON.stringify(
      {
        parent: 'minecraft:block/cube_column',
        textures: { end: tex, side: tex }
      },
      null,
      2
    )}\n`
  }
  return `${JSON.stringify({ parent: 'minecraft:block/cube_all', textures: { all: tex } }, null, 2)}\n`
}

export function slabModelJson(modId: string, block: SpecBlock, painted: boolean, top: boolean): string {
  const tex = textureId(modId, block, painted)
  return `${JSON.stringify(
    {
      parent: top ? 'minecraft:block/slab_top' : 'minecraft:block/slab',
      textures: { bottom: tex, top: tex, side: tex }
    },
    null,
    2
  )}\n`
}

export function stairsModelJson(
  modId: string,
  block: SpecBlock,
  painted: boolean,
  kind: 'straight' | 'inner' | 'outer'
): string {
  const tex = textureId(modId, block, painted)
  const parent =
    kind === 'inner' ? 'minecraft:block/inner_stairs' : kind === 'outer' ? 'minecraft:block/outer_stairs' : 'minecraft:block/stairs'
  return `${JSON.stringify({ parent, textures: { bottom: tex, top: tex, side: tex } }, null, 2)}\n`
}

export function blockItemModelJson(modId: string, block: SpecBlock): string {
  return `${JSON.stringify({ parent: `${modId}:block/${block.id}` }, null, 2)}\n`
}

export function variantItemModelJson(modId: string, modelId: string): string {
  return `${JSON.stringify({ parent: `${modId}:block/${modelId}` }, null, 2)}\n`
}

export function blockLootJson(spec: ProjectSpec, block: SpecBlock, variantId = block.id): string {
  return `${JSON.stringify(
    {
      type: 'minecraft:block',
      pools: [
        {
          rolls: 1.0,
          entries: [
            {
              type: 'minecraft:item',
              name: resolveBlockDropName(spec, block, variantId)
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

function variantAssetFiles(spec: ProjectSpec, block: SpecBlock): PlannedFile[] {
  const files: PlannedFile[] = []
  if (block.slab) {
    const id = slabId(block.id)
    files.push(
      {
        relativePath: `src/main/resources/assets/${spec.modId}/blockstates/${id}.json`,
        encoding: 'utf8',
        contents: slabBlockStateJson(spec.modId, block)
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/block/${id}.json`,
        encoding: 'utf8',
        contents: slabModelJson(spec.modId, block, false, false)
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/block/${id}_top.json`,
        encoding: 'utf8',
        contents: slabModelJson(spec.modId, block, false, true)
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/item/${id}.json`,
        encoding: 'utf8',
        contents: variantItemModelJson(spec.modId, id)
      },
      {
        relativePath: `src/main/resources/data/${spec.modId}/loot_table/blocks/${id}.json`,
        encoding: 'utf8',
        contents: blockLootJson(spec, block, id)
      }
    )
  }
  if (block.stairs) {
    const id = stairsId(block.id)
    files.push(
      {
        relativePath: `src/main/resources/assets/${spec.modId}/blockstates/${id}.json`,
        encoding: 'utf8',
        contents: stairsBlockStateJson(spec.modId, block)
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/block/${id}.json`,
        encoding: 'utf8',
        contents: stairsModelJson(spec.modId, block, false, 'straight')
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/block/${id}_inner.json`,
        encoding: 'utf8',
        contents: stairsModelJson(spec.modId, block, false, 'inner')
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/block/${id}_outer.json`,
        encoding: 'utf8',
        contents: stairsModelJson(spec.modId, block, false, 'outer')
      },
      {
        relativePath: `src/main/resources/assets/${spec.modId}/models/item/${id}.json`,
        encoding: 'utf8',
        contents: variantItemModelJson(spec.modId, id)
      },
      {
        relativePath: `src/main/resources/data/${spec.modId}/loot_table/blocks/${id}.json`,
        encoding: 'utf8',
        contents: blockLootJson(spec, block, id)
      }
    )
  }
  return files
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
    },
    ...variantAssetFiles(spec, block)
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
    .map((block) => {
      const extras = [
        block.shape,
        block.slab ? 'slab' : '',
        block.stairs ? 'stairs' : ''
      ]
        .filter(Boolean)
        .join(', ')
      return `- ${block.id}: ${block.material} ${extras} hardness=${block.hardness} drop=${block.dropItem}`
    })
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
          `${platform} registers cube_all or pillar (axis) blocks, plus optional slab/stairs variants from the parent.`,
          'Pillar uses axis blockstates (x/y/z). Slab/stairs reuse the parent texture. Not a multipart inventory API.',
          rows || '- No custom blocks in this spec.',
          ''
        ].join('\n')
  return [{ relativePath: 'BLOCKS.md', encoding: 'utf8', contents }]
}

function fabricCtor(block: SpecBlock, settings: string): string {
  if (block.shape === 'pillar') {
    return `new PillarBlock(${settings})`
  }
  return `new Block(${settings})`
}

function fabricSettings(block: SpecBlock, classic: boolean, keyExpr?: string): string {
  const sound = yarnBlockSound(block.material)
  const base = classic
    ? `AbstractBlock.Settings.create().strength(${block.hardness}f, ${block.resistance}f).sounds(BlockSoundGroup.${sound})`
    : `AbstractBlock.Settings.create().registryKey(${keyExpr}).strength(${block.hardness}f, ${block.resistance}f).sounds(BlockSoundGroup.${sound})`
  return base
}

function fabricRegisterPair(id: string, ctor: string, classic: boolean): string {
  if (classic) {
    return `  public static final Block ${blockField(id)} = Registry.register(
    Registries.BLOCK,
    Identifier.of(MOD_ID, "${id}"),
    ${ctor}
  );

  public static final Item ${blockItemField(id)} = Registry.register(
    Registries.ITEM,
    Identifier.of(MOD_ID, "${id}"),
    new BlockItem(${blockField(id)}, new Item.Settings())
  );`
  }
  return `  public static final RegistryKey<Block> ${blockField(id)}_KEY = RegistryKey.of(
    RegistryKeys.BLOCK,
    Identifier.of(MOD_ID, "${id}")
  );
  public static final RegistryKey<Item> ${blockItemField(id)}_KEY = RegistryKey.of(
    RegistryKeys.ITEM,
    Identifier.of(MOD_ID, "${id}")
  );
  public static final Block ${blockField(id)} = Registry.register(
    Registries.BLOCK,
    ${blockField(id)}_KEY,
    ${ctor}
  );
  public static final Item ${blockItemField(id)} = Registry.register(
    Registries.ITEM,
    ${blockItemField(id)}_KEY,
    new BlockItem(${blockField(id)}, new Item.Settings().registryKey(${blockItemField(id)}_KEY))
  );`
}

export function fabricNeedsPillar(spec: ProjectSpec): boolean {
  return spec.blocks.some((block) => block.shape === 'pillar')
}

export function fabricNeedsSlab(spec: ProjectSpec): boolean {
  return spec.blocks.some((block) => block.slab)
}

export function fabricNeedsStairs(spec: ProjectSpec): boolean {
  return spec.blocks.some((block) => block.stairs)
}

export function fabricBlockFields(spec: ProjectSpec, classic: boolean): string {
  return spec.blocks
    .flatMap((block) => {
      const chunks = [
        fabricRegisterPair(
          block.id,
          fabricCtor(block, fabricSettings(block, classic, `${blockField(block.id)}_KEY`)),
          classic
        )
      ]
      if (block.slab) {
        const id = slabId(block.id)
        chunks.push(
          fabricRegisterPair(id, `new SlabBlock(${fabricSettings(block, classic, `${blockField(id)}_KEY`)})`, classic)
        )
      }
      if (block.stairs) {
        const id = stairsId(block.id)
        chunks.push(
          fabricRegisterPair(
            id,
            `new StairsBlock(${blockField(block.id)}.getDefaultState(), ${fabricSettings(block, classic, `${blockField(id)}_KEY`)})`,
            classic
          )
        )
      }
      return chunks
    })
    .join('\n\n')
}

export function fabricBlockCreativeAdds(spec: ProjectSpec): string {
  return spec.blocks
    .flatMap((block) => [
      `      entries.add(${blockItemField(block.id)});`,
      ...derivedBlockIds(block).map((id) => `      entries.add(${blockItemField(id)});`)
    ])
    .join('\n')
}

export function forgeNeedsRotatedPillar(spec: ProjectSpec): boolean {
  return spec.blocks.some((block) => block.shape === 'pillar')
}

export function forgeNeedsSlab(spec: ProjectSpec): boolean {
  return spec.blocks.some((block) => block.slab)
}

export function forgeNeedsStairs(spec: ProjectSpec): boolean {
  return spec.blocks.some((block) => block.stairs)
}

function mojangProps(block: SpecBlock): string {
  const sound = mojangBlockSound(block.material)
  return `BlockBehaviour.Properties.of().strength(${block.hardness}f, ${block.resistance}f).sound(SoundType.${sound})`
}

function forgeCtor(block: SpecBlock): string {
  if (block.shape === 'pillar') {
    return `new RotatedPillarBlock(${mojangProps(block)})`
  }
  return `new Block(${mojangProps(block)})`
}

export function forgeBlockRegs(spec: ProjectSpec): string {
  return spec.blocks
    .flatMap((block) => {
      const chunks = [
        `  public static final RegistryObject<Block> ${blockField(block.id)} = BLOCKS.register("${block.id}",
    () -> ${forgeCtor(block)});

  public static final RegistryObject<Item> ${blockItemField(block.id)} = ITEMS.register("${block.id}",
    () -> new BlockItem(${blockField(block.id)}.get(), new Item.Properties()));`
      ]
      if (block.slab) {
        const id = slabId(block.id)
        chunks.push(`  public static final RegistryObject<Block> ${blockField(id)} = BLOCKS.register("${id}",
    () -> new SlabBlock(${mojangProps(block)}));

  public static final RegistryObject<Item> ${blockItemField(id)} = ITEMS.register("${id}",
    () -> new BlockItem(${blockField(id)}.get(), new Item.Properties()));`)
      }
      if (block.stairs) {
        const id = stairsId(block.id)
        chunks.push(`  public static final RegistryObject<Block> ${blockField(id)} = BLOCKS.register("${id}",
    () -> new StairBlock(${blockField(block.id)}.get().defaultBlockState(), ${mojangProps(block)}));

  public static final RegistryObject<Item> ${blockItemField(id)} = ITEMS.register("${id}",
    () -> new BlockItem(${blockField(id)}.get(), new Item.Properties()));`)
      }
      return chunks
    })
    .join('\n\n')
}

export function forgeBlockCreative(spec: ProjectSpec): string {
  return spec.blocks
    .flatMap((block) => [
      `      event.accept(${blockItemField(block.id)});`,
      ...derivedBlockIds(block).map((id) => `      event.accept(${blockItemField(id)});`)
    ])
    .join('\n')
}

export function neoBlockRegs(spec: ProjectSpec): string {
  return spec.blocks
    .flatMap((block) => {
      const chunks = [
        `  public static final DeferredBlock<Block> ${blockField(block.id)} = BLOCKS.register(
    "${block.id}",
    () -> ${forgeCtor(block)}
  );
  public static final DeferredItem<BlockItem> ${blockItemField(block.id)} = ITEMS.registerSimpleBlockItem(${blockField(block.id)});`
      ]
      if (block.slab) {
        const id = slabId(block.id)
        chunks.push(`  public static final DeferredBlock<Block> ${blockField(id)} = BLOCKS.register(
    "${id}",
    () -> new SlabBlock(${mojangProps(block)})
  );
  public static final DeferredItem<BlockItem> ${blockItemField(id)} = ITEMS.registerSimpleBlockItem(${blockField(id)});`)
      }
      if (block.stairs) {
        const id = stairsId(block.id)
        chunks.push(`  public static final DeferredBlock<Block> ${blockField(id)} = BLOCKS.register(
    "${id}",
    () -> new StairBlock(${blockField(block.id)}.get().defaultBlockState(), ${mojangProps(block)})
  );
  public static final DeferredItem<BlockItem> ${blockItemField(id)} = ITEMS.registerSimpleBlockItem(${blockField(id)});`)
      }
      return chunks
    })
    .join('\n\n')
}

export function itemEntryExpr(spec: ProjectSpec, itemId: string, flavor: 'fabric' | 'forge' | 'neoforge'): string {
  if (itemId.startsWith('minecraft:')) {
    const name = itemId.slice('minecraft:'.length)
    return `Items.${name.toUpperCase()}`
  }
  const item = spec.items.find((entry) => entry.id === itemId)
  if (item) {
    return flavor === 'fabric' ? toConstName(item.id) : `${toConstName(item.id)}.get()`
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

export function blockLangEntries(spec: ProjectSpec): Record<string, string> {
  const lang: Record<string, string> = {}
  for (const block of spec.blocks) {
    lang[`block.${spec.modId}.${block.id}`] = block.displayName
    lang[`item.${spec.modId}.${block.id}`] = block.displayName
    if (block.slab) {
      const id = slabId(block.id)
      lang[`block.${spec.modId}.${id}`] = `${block.displayName} Slab`
      lang[`item.${spec.modId}.${id}`] = `${block.displayName} Slab`
    }
    if (block.stairs) {
      const id = stairsId(block.id)
      lang[`block.${spec.modId}.${id}`] = `${block.displayName} Stairs`
      lang[`item.${spec.modId}.${id}`] = `${block.displayName} Stairs`
    }
  }
  return lang
}
