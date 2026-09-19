import { describe, expect, it } from 'vitest'
import {
  COMPATIBILITY_REGISTRY,
  assertCreatableCombination,
  lookupCompatibility
} from '../src/shared/compatibility'

describe('compatibility registry', () => {
  it('never marks a row as Tested in Phase 1', () => {
    const tested = COMPATIBILITY_REGISTRY.filter((entry) => entry.status === 'tested')
    expect(tested).toEqual([])
  })

  it('looks up a known experimental pair', () => {
    const entry = lookupCompatibility('fabric', '1.21.1')
    expect(entry.status).toBe('experimental')
    expect(entry.notes.length).toBeGreaterThan(10)
  })

  it('returns unsupported for versions absent from the registry', () => {
    const entry = lookupCompatibility('forge', '1.7.10')
    expect(entry.status).toBe('unsupported')
  })

  it('marks NeoForge 1.20.1 unsupported', () => {
    expect(lookupCompatibility('neoforge', '1.20.1').status).toBe('unsupported')
  })

  it('allows creating experimental combinations and blocks unsupported ones', () => {
    expect(assertCreatableCombination('paper', '1.21.1').status).toBe('experimental')
    expect(() => assertCreatableCombination('spigot', '1.21.8')).toThrow(/unsupported/)
  })

  it('covers all five platforms', () => {
    const platforms = new Set(COMPATIBILITY_REGISTRY.map((entry) => entry.platform))
    expect([...platforms].sort()).toEqual(['fabric', 'forge', 'neoforge', 'paper', 'spigot'])
  })
})
