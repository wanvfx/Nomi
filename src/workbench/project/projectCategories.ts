import { z } from 'zod'

export const CATEGORY_VIEW_TYPES = [
  'document',
  'card-grid',
  'graph-canvas',
  'asset-library',
  'list-with-status',
  'audio-list',
] as const

export type CategoryViewType = (typeof CATEGORY_VIEW_TYPES)[number]

export type ProjectCategory = {
  id: string
  name: string
  icon: string
  color?: string
  order: number
  viewType: CategoryViewType
  isBuiltin: boolean
  isHidden?: boolean
}

export const BUILTIN_CATEGORY_IDS = [
  'shots',
  'cast',
  'scene',
  'prop',
  'audio',
] as const

export type BuiltinCategoryId = (typeof BUILTIN_CATEGORY_IDS)[number]

export const BUILTIN_CATEGORIES: ProjectCategory[] = [
  { id: 'shots', name: '分镜', icon: '🎬', order: 1, viewType: 'graph-canvas', isBuiltin: true },
  { id: 'cast', name: '角色', icon: '👥', order: 2, viewType: 'card-grid', isBuiltin: true },
  { id: 'scene', name: '场景', icon: '🌍', order: 3, viewType: 'card-grid', isBuiltin: true },
  { id: 'prop', name: '道具', icon: '🧰', order: 4, viewType: 'card-grid', isBuiltin: true },
  { id: 'audio', name: '声音', icon: '🎵', order: 5, viewType: 'audio-list', isBuiltin: true },
]

export const DEFAULT_CATEGORY_ID: BuiltinCategoryId = 'shots'
export const FALLBACK_CATEGORY_ID: BuiltinCategoryId = 'shots'

export const projectCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string(),
  color: z.string().optional(),
  order: z.number().finite(),
  viewType: z.enum(CATEGORY_VIEW_TYPES),
  isBuiltin: z.boolean(),
  isHidden: z.boolean().optional(),
})

export function getBuiltinCategoryById(id: string): ProjectCategory | null {
  return BUILTIN_CATEGORIES.find((cat) => cat.id === id) || null
}

export function isBuiltinCategoryId(id: string): id is BuiltinCategoryId {
  return (BUILTIN_CATEGORY_IDS as readonly string[]).includes(id)
}

export function cloneBuiltinCategories(): ProjectCategory[] {
  return BUILTIN_CATEGORIES.map((cat) => ({ ...cat }))
}

export function normalizeCategories(input: unknown): ProjectCategory[] {
  if (!Array.isArray(input)) return cloneBuiltinCategories()
  const merged = new Map<string, ProjectCategory>()
  for (const cat of cloneBuiltinCategories()) merged.set(cat.id, cat)
  for (const item of input) {
    const parsed = projectCategorySchema.safeParse(item)
    if (!parsed.success) continue
    if (!isBuiltinCategoryId(parsed.data.id)) continue
    merged.set(parsed.data.id, parsed.data)
  }
  return Array.from(merged.values()).sort((a, b) => a.order - b.order)
}
