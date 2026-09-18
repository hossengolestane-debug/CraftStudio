import { INJECTED_CHEST_TABLES, injectedChestFileStem, injectedChestPath } from '../../../shared/lootInject'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { blockItemField } from '../blocks/registration'
import type { PlannedFile } from '../types'

export function fabricLootModify(spec: ProjectSpec, classic: boolean): string {
  if (spec.items.length === 0 && spec.blocks.length === 0) {
    return ''
  }
  const entries = [
    ...spec.items.map((item) => `      pool.with(ItemEntry.builder(${toConstName(item.id)}));`),
    ...spec.blocks.map((block) => `      pool.with(ItemEntry.builder(${blockItemField(block.id)}));`)
  ].join('\n')
  const checks = INJECTED_CHEST_TABLES.map((table) => `path.equals("${injectedChestPath(table)}")`).join(' || ')
  const args = classic
    ? '(key, tableBuilder, source)'
    : '(key, tableBuilder, source, registries)'
  return `
    LootTableEvents.MODIFY.register(${args} -> {
      if (!source.isBuiltin()) {
        return;
      }
      var id = key.getValue();
      String path = id.getPath();
      if (!"minecraft".equals(id.getNamespace())) {
        return;
      }
      if (!(${checks})) {
        return;
      }
      LootPool.Builder pool = LootPool.builder();
${entries}
      tableBuilder.pool(pool);
    });`
}

export function planForgeLikeLootModifierFiles(
  spec: ProjectSpec,
  packagePath: string,
  flavor: 'forge' | 'neoforge'
): PlannedFile[] {
  if (spec.items.length === 0 && spec.blocks.length === 0) {
    return []
  }
  const files: PlannedFile[] = []
  const lootNs = flavor === 'neoforge' ? 'neoforge' : 'forge'
  const pkg = flavor === 'neoforge' ? 'net.neoforged.neoforge.common.loot' : 'net.minecraftforge.common.loot'
  const adds = [
    ...spec.items.map((item) => `    generatedLoot.add(new ItemStack(${spec.mainClass}.${toConstName(item.id)}.get()));`),
    ...spec.blocks.map((block) => `    generatedLoot.add(new ItemStack(${spec.mainClass}.${blockItemField(block.id)}.get()));`)
  ].join('\n')
  files.push({
    relativePath: `src/main/java/${packagePath}/AddBonusChestModifier.java`,
    encoding: 'utf8',
    contents: `package ${spec.packageName};

import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import it.unimi.dsi.fastutil.objects.ObjectArrayList;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.storage.loot.LootContext;
import net.minecraft.world.level.storage.loot.predicates.LootItemCondition;
import ${pkg}.IGlobalLootModifier;
import ${pkg}.LootModifier;

public class AddBonusChestModifier extends LootModifier {
  public static final MapCodec<AddBonusChestModifier> CODEC = RecordCodecBuilder.mapCodec(inst ->
    LootModifier.codecStart(inst).apply(inst, AddBonusChestModifier::new));

  public AddBonusChestModifier(LootItemCondition[] conditionsIn) {
    super(conditionsIn);
  }

  @Override
  protected ObjectArrayList<ItemStack> doApply(ObjectArrayList<ItemStack> generatedLoot, LootContext context) {
${adds}
    return generatedLoot;
  }

  @Override
  public MapCodec<? extends IGlobalLootModifier> codec() {
    return CODEC;
  }
}
`
  })

  const entries = INJECTED_CHEST_TABLES.map((table) => `${spec.modId}:${injectedChestFileStem(table)}`)
  files.push({
    relativePath: `src/main/resources/data/${lootNs}/loot_modifiers/global_loot_modifiers.json`,
    encoding: 'utf8',
    contents: `${JSON.stringify({ replace: false, entries }, null, 2)}\n`
  })

  for (const table of INJECTED_CHEST_TABLES) {
    files.push({
      relativePath: `src/main/resources/data/${spec.modId}/loot_modifiers/${injectedChestFileStem(table)}.json`,
      encoding: 'utf8',
      contents: `${JSON.stringify(
        {
          type: `${spec.modId}:add_bonus_chest`,
          conditions: [
            {
              condition: `${lootNs}:loot_table_id`,
              loot_table_id: table
            }
          ]
        },
        null,
        2
      )}\n`
    })
  }
  return files
}

export function updateLootDoc(existing: string, injected: boolean, plugin: boolean): string {
  if (plugin) {
    return existing.replace(
      'Chest bonus table',
      'Chest bonus JSON is **not** emitted for plugins. Chest bonus table'
    )
  }
  if (!injected) {
    return existing
  }
  return existing.replace(
    'but is **not** injected into vanilla chests.',
    `is injected into this allowlist only: ${INJECTED_CHEST_TABLES.join(', ')}. Other chests are untouched.`
  )
}
