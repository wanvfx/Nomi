import { beforeEach, describe, expect, it } from 'vitest'
import { useGenerationCanvasStore } from './generationCanvasStore'
import type { GenerationCanvasNode, NodeGroup } from '../model/generationCanvasTypes'

function node(id: string, categoryId: GenerationCanvasNode['categoryId'], groupId?: string): GenerationCanvasNode {
  return {
    id,
    kind: 'image',
    title: id,
    position: { x: 10, y: 20 },
    prompt: `${id} prompt`,
    categoryId,
    ...(groupId ? { groupId } : {}),
  }
}

function group(id: string, categoryId: NodeGroup['categoryId'], nodeIds: string[] = []): NodeGroup {
  return {
    id,
    name: id,
    categoryId,
    nodeIds,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('generationCanvasStore sidebar grouping actions', () => {
  beforeEach(() => {
    useGenerationCanvasStore.getState().restoreSnapshot({
      nodes: [
        node('shot-1', 'shots'),
        node('cast-1', 'cast', 'cast-group'),
      ],
      edges: [],
      selectedNodeIds: [],
      groups: [
        group('cast-group', 'cast', ['cast-1']),
        group('cast-group-2', 'cast', []),
        group('shots-group', 'shots', []),
      ],
    })
  })

  it('copies a node into another category as an independent derived node', () => {
    const copied = useGenerationCanvasStore.getState().copyNodeToCategory('cast-1', 'shots')

    expect(copied).toBeTruthy()
    expect(copied?.id).not.toBe('cast-1')
    expect(copied?.categoryId).toBe('shots')
    expect(copied?.groupId).toBeUndefined()
    expect(copied?.derivedFrom).toBe('cast-1')

    const state = useGenerationCanvasStore.getState()
    expect(state.nodes.find((candidate) => candidate.id === 'cast-1')?.categoryId).toBe('cast')
    expect(state.nodes.some((candidate) => candidate.id === copied?.id)).toBe(true)
  })

  it('moves same-category nodes into groups and removes them from prior groups', () => {
    useGenerationCanvasStore.getState().moveNodeToGroup('cast-1', 'cast-group-2')

    const state = useGenerationCanvasStore.getState()
    expect(state.nodes.find((candidate) => candidate.id === 'cast-1')?.categoryId).toBe('cast')
    expect(state.nodes.find((candidate) => candidate.id === 'cast-1')?.groupId).toBe('cast-group-2')
    expect(state.groups.find((candidate) => candidate.id === 'cast-group')?.nodeIds).toEqual([])
    expect(state.groups.find((candidate) => candidate.id === 'cast-group-2')?.nodeIds).toEqual(['cast-1'])
  })

  it('does not move an existing node into a group from another category', () => {
    useGenerationCanvasStore.getState().moveNodeToGroup('shot-1', 'cast-group-2')

    const state = useGenerationCanvasStore.getState()
    expect(state.nodes.find((candidate) => candidate.id === 'shot-1')?.categoryId).toBe('shots')
    expect(state.nodes.find((candidate) => candidate.id === 'shot-1')?.groupId).toBeUndefined()
    expect(state.groups.find((candidate) => candidate.id === 'cast-group-2')?.nodeIds).toEqual([])
  })

  it('can copy a cross-category node and then place the copy in the target group', () => {
    const copied = useGenerationCanvasStore.getState().copyNodeToCategory('cast-1', 'shots')
    expect(copied).toBeTruthy()

    useGenerationCanvasStore.getState().moveNodeToGroup(copied?.id || '', 'shots-group')

    const state = useGenerationCanvasStore.getState()
    const source = state.nodes.find((candidate) => candidate.id === 'cast-1')
    const targetCopy = state.nodes.find((candidate) => candidate.id === copied?.id)
    expect(source?.categoryId).toBe('cast')
    expect(source?.groupId).toBe('cast-group')
    expect(targetCopy?.categoryId).toBe('shots')
    expect(targetCopy?.groupId).toBe('shots-group')
    expect(targetCopy?.derivedFrom).toBe('cast-1')
    expect(state.groups.find((candidate) => candidate.id === 'shots-group')?.nodeIds).toEqual([copied?.id])
  })

  it('removes a node from its group without changing its category', () => {
    useGenerationCanvasStore.getState().removeNodeFromGroup('cast-1')

    const state = useGenerationCanvasStore.getState()
    expect(state.nodes.find((candidate) => candidate.id === 'cast-1')?.categoryId).toBe('cast')
    expect(state.nodes.find((candidate) => candidate.id === 'cast-1')?.groupId).toBeUndefined()
    expect(state.groups.find((candidate) => candidate.id === 'cast-group')?.nodeIds).toEqual([])
  })
})
