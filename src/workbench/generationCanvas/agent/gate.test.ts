import { describe, expect, it } from 'vitest'
import { evaluateGate } from './gate'

describe('evaluateGate — 统一求值流(§6.1)', () => {
  it('① policy:只读工具直通 allow', () => {
    expect(evaluateGate({ kind: 'tool-call', toolName: 'read_canvas_state', args: {} })).toEqual({ outcome: 'allow' })
  })

  it('③ ask:写工具排队等点头', () => {
    for (const toolName of ['create_canvas_nodes', 'connect_canvas_edges', 'set_node_prompt']) {
      expect(evaluateGate({ kind: 'tool-call', toolName, args: {} })).toEqual({ outcome: 'ask' })
    }
  })

  it('破坏性工具同样 ask(确认门管同一条)', () => {
    expect(evaluateGate({ kind: 'tool-call', toolName: 'delete_canvas_nodes', args: { nodeIds: ['n1'] } })).toEqual({
      outcome: 'ask',
    })
  })

  it('② invariant:不认识的工具 deny,reason 是人话', () => {
    const decision = evaluateGate({ kind: 'tool-call', toolName: 'rm_rf_everything', args: {} })
    expect(decision.outcome).toBe('deny')
    if (decision.outcome === 'deny') expect(decision.reason).toContain('rm_rf_everything')
  })

  it('纯函数:同入参恒同出参', () => {
    const intent = { kind: 'tool-call' as const, toolName: 'set_node_prompt', args: { nodeId: 'n1', prompt: 'x' } }
    expect(evaluateGate(intent)).toEqual(evaluateGate(intent))
  })

  it('S6-4 占位:ctx 带 lockedNodeIds 也不改本片决策(锁规则未实现)', () => {
    const decision = evaluateGate(
      { kind: 'tool-call', toolName: 'set_node_prompt', args: { nodeId: 'n1', prompt: 'x' } },
      { lockedNodeIds: new Set(['n1']) },
    )
    expect(decision).toEqual({ outcome: 'ask' })
  })

  it('batch-run / spend intent 先一律 ask(S6b/S7 落地语义)', () => {
    expect(evaluateGate({ kind: 'batch-run', nodeIds: ['n1', 'n2'] })).toEqual({ outcome: 'ask' })
    expect(evaluateGate({ kind: 'spend', estimatedCost: 1.5 })).toEqual({ outcome: 'ask' })
  })
})
