import { describe, expect, it } from 'vitest'
import {
  COMPATIBILITY_REGISTRY,
  assertCreatableCombination,
  lookupCompatibility
} from '../src/shared/compatibility'
import {
  assertCanRecordEvidence,
  canMarkTested,
  overlayCompatibility,
  type RuntimeEvidenceRecord
} from '../src/shared/evidence'

const validClient: RuntimeEvidenceRecord = {
  id: '11111111-2222-4333-8444-555555555555',
  timestamp: '2026-09-18T03:00:00.000Z',
  platform: 'fabric',
  minecraftVersion: '1.21.1',
  projectId: 'proj-1',
  verifiedWhat: 'fabric_run_client',
  notes: 'runClient reached the title screen with the custom item in Ingredients.',
  eulaAccepted: true,
  compileOnly: false,
  runtimeExitCode: 0
}

describe('Tested evidence gating', () => {
  it('keeps the static registry free of Tested rows', () => {
    expect(COMPATIBILITY_REGISTRY.filter((entry) => entry.status === 'tested')).toEqual([])
  })

  it('cannot mark Tested from a compile-only build', () => {
    expect(() =>
      assertCanRecordEvidence(
        {
          platform: 'fabric',
          minecraftVersion: '1.21.1',
          projectId: 'proj-1',
          verifiedWhat: 'fabric_run_client',
          notes: 'Gradle build succeeded',
          eulaAccepted: true,
          compileOnly: true,
          runtimeExitCode: 0
        },
        { task: 'build', exitCode: 0, compileOnly: true, cancelled: false, timedOut: false }
      )
    ).toThrow(/compile-only/)
    expect(canMarkTested({ ...validClient, compileOnly: true })).toBe(false)
  })

  it('requires a successful runClient plus EULA for Fabric/NeoForge', () => {
    expect(() =>
      assertCanRecordEvidence(
        {
          platform: 'fabric',
          minecraftVersion: '1.21.1',
          projectId: 'proj-1',
          verifiedWhat: 'fabric_run_client',
          notes: 'tried client',
          eulaAccepted: true,
          compileOnly: false
        },
        { task: 'build', exitCode: 0, compileOnly: true, cancelled: false, timedOut: false }
      )
    ).toThrow(/runClient/)
    expect(() =>
      assertCanRecordEvidence({
        platform: 'fabric',
        minecraftVersion: '1.21.1',
        projectId: 'proj-1',
        verifiedWhat: 'fabric_run_client',
        notes: 'client',
        eulaAccepted: false,
        compileOnly: false
      })
    ).toThrow(/EULA/)
    expect(
      canMarkTested({
        ...validClient,
        verifiedWhat: 'neoforge_run_client',
        platform: 'neoforge',
        runtimeExitCode: 1
      })
    ).toBe(false)
  })

  it('requires Paper user attestation and never infers Spigot', () => {
    expect(() =>
      assertCanRecordEvidence({
        platform: 'paper',
        minecraftVersion: '1.21.1',
        projectId: 'proj-2',
        verifiedWhat: 'paper_user_server',
        notes: 'I compiled the plugin',
        eulaAccepted: true,
        compileOnly: false,
        userAttestedLaunch: false
      })
    ).toThrow(/attest/)
    expect(() =>
      assertCanRecordEvidence({
        platform: 'spigot',
        minecraftVersion: '1.21.1',
        projectId: 'proj-2',
        verifiedWhat: 'paper_user_server',
        notes: 'ran a server',
        eulaAccepted: true,
        compileOnly: false,
        userAttestedLaunch: true
      })
    ).toThrow(/Paper/)
  })

  it('overlays Tested only when a valid evidence record exists', () => {
    const without = overlayCompatibility([lookupCompatibility('fabric', '1.21.1')], [])
    expect(without[0]?.status).toBe('experimental')
    const withEvidence = overlayCompatibility([lookupCompatibility('fabric', '1.21.1')], [validClient])
    expect(withEvidence[0]?.status).toBe('tested')
    expect(withEvidence[0]?.notes).toContain('fabric_run_client')
    expect(assertCreatableCombination('fabric', '1.21.1', [validClient]).status).toBe('tested')
    expect(assertCreatableCombination('fabric', '1.21.1', []).status).toBe('experimental')
  })
})
