import { describe, expect, it } from 'vitest'
import { formatMemoryForPrompt, type MemoryFactView } from './projectMemoryClient'

const fact = (id: string, text: string, extra: Partial<MemoryFactView> = {}): MemoryFactView => ({
  id,
  text,
  kind: 'character',
  origin: 'auto',
  sourceSeqs: [1],
  pinned: false,
  updatedAt: '2026-06-12T00:00:00Z',
  ...extra,
})

describe('formatMemoryForPrompt — S9 注入段(预算 + 排序)', () => {
  it('空记忆零注入', () => {
    expect(formatMemoryForPrompt([])).toBe('')
  })

  it('裁剪顺序:pinned > 用户纠正 > 自动 + 新近度', () => {
    const facts = [
      fact('a', '自动旧', { updatedAt: '2026-06-01T00:00:00Z' }),
      fact('b', '用户纠正的', { origin: 'user' }),
      fact('c', '置顶的', { pinned: true, updatedAt: '2026-05-01T00:00:00Z' }),
      fact('d', '自动新', { updatedAt: '2026-06-12T00:00:00Z' }),
    ]
    const block = formatMemoryForPrompt(facts)
    const order = ['置顶的', '用户纠正的', '自动新', '自动旧'].map((needle) => block.indexOf(needle))
    expect([...order].sort((x, y) => x - y)).toEqual(order)
  })

  it('超预算按序截断,不超不裁', () => {
    const facts = Array.from({ length: 50 }, (_, index) => fact(`f${index}`, `事实${index}`.padEnd(100, '。')))
    const block = formatMemoryForPrompt(facts, 500)
    expect(block.length).toBeLessThanOrEqual(500 + 40) // 标题行不计预算
    expect(block).toContain('事实0')
    expect(block).not.toContain('事实49')
  })
})
