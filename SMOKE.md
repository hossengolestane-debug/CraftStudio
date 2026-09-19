# Smoke checklist — platforms / features

Use this after Apply. Compile-only Gradle never marks **Tested**. Runtime evidence is a separate step.

Legend: **Works** = trusted template emits and is intended to compile on that pin. **Experimental** = emits or is documented but not Minecraft-runtime verified here. **Unsupported** = rejected or honestly omitted.

| Feature | Fabric 1.21 / 1.21.1 | Fabric 1.21.2+ | Forge 1.21.1 | NeoForge 1.21.1 | NeoForge 1.21.4 / 1.21.8 | Paper | Spigot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Custom items | Works | Works | Works | Works | Works | Limited (paper + PDC + CMD) | Limited (paper + PDC + CMD) |
| Cube-all block | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Pillar / axis block | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Slab + stairs from parent | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Inventory BlockEntity | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported |
| Plugin custom blocks | — | — | — | — | — | Unsupported | Unsupported |
| Ore vein | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Surface patch | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Spring (`spring_feature`) | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Custom dimension | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported |
| Chest loot inject (4 tables) | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Mob presets + capped goals | Works | Works | Works | Works | Works | Limited (vanilla disguise) | Limited (vanilla disguise) |
| Goal priorities / both targeting | Works | Works | Works | Works | Works | Limited (disguise only) | Limited (disguise only) |
| Attack damage / follow range | Works | Works | Works | Works | Works | Limited | Limited |
| Biome spawn tables | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| JSON mod config | Works | Works | Works | Works | Works | Unsupported | Unsupported |
| Datapack ZIP (loot + worldgen JSON) | Experimental | Experimental | Experimental | Experimental | Experimental | Experimental (JSON only; no plugin blocks) | Experimental (JSON only) |
| Visible cube mob renderer | Works | Works (render-state) | Works | Works | Works | Unsupported (clients see vanilla) | Unsupported |
| Preview GUI / menu | Works | Works | Works | Works | Works | Limited (Bukkit inventory) | Limited (Bukkit inventory) |
| Resource pack export | Works | Works | Works | Works | Works | Works (every client must install) | Works (every client must install) |
| `./gradlew build` compile | Experimental until evidence | Experimental | Experimental until evidence | Experimental | Experimental | Experimental | Experimental |
| Compatibility **Tested** | Evidence-gated | Evidence-gated | Evidence-gated | Evidence-gated | Evidence-gated | Evidence-gated | Evidence-gated |
| Signed installer | Unsupported (no cert) | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported |

## Notes

- Forge is not NeoForge. Paper is not Spigot.
- Datapack ZIP does not add features to biomes and does not inject vanilla chests. Use the Java mod for that.
- Fabric `enableWorldgen` / `enableChestLoot` / `spawnWeightScale` are runtime. Forge/NeoForge chest inject is runtime; worldgen biome modifiers follow the Apply-time toggle; spawn scale is baked into JSON.
- This environment may record compile-only BUILD SUCCESSFUL. That is not Tested.
