import React from 'react'
import { cn } from '../../utils/cn'
import { BUILTIN_CATEGORIES, type ProjectCategory } from '../project/projectCategories'
import { useWorkbenchStore } from '../workbenchStore'
import { useGenerationCanvasStore } from '../generationCanvasV2/store/generationCanvasStore'
import CategoryItem from './CategoryItem'
import GroupItem from './GroupItem'
import NodeItem from './NodeItem'

type Props = {
  categories?: ProjectCategory[]
}

export default function CategorySidebar({ categories }: Props): JSX.Element {
  const collapsed = useWorkbenchStore((s) => s.sidebarCollapsed)
  const toggle = useWorkbenchStore((s) => s.toggleSidebarCollapsed)
  const activeCategoryId = useWorkbenchStore((s) => s.activeCategoryId)
  const setActiveCategoryId = useWorkbenchStore((s) => s.setActiveCategoryId)
  const nodes = useGenerationCanvasStore((s) => s.nodes)
  const groups = useGenerationCanvasStore((s) => s.groups)
  const selectedNodeIds = useGenerationCanvasStore((s) => s.selectedNodeIds)
  const selectNode = useGenerationCanvasStore((s) => s.selectNode)
  const copyNodeToCategory = useGenerationCanvasStore((s) => s.copyNodeToCategory)
  const moveNodeToGroup = useGenerationCanvasStore((s) => s.moveNodeToGroup)
  const removeNodeFromGroup = useGenerationCanvasStore((s) => s.removeNodeFromGroup)
  const reorderGroup = useGenerationCanvasStore((s) => s.reorderGroup)
  const [expandedCategoryIds, setExpandedCategoryIds] = React.useState<Set<string>>(() => new Set([activeCategoryId]))

  const visible = React.useMemo(() => {
    const list = (categories && categories.length ? categories : BUILTIN_CATEGORIES)
      .filter((c) => !c.isHidden)
      .slice()
      .sort((a, b) => a.order - b.order)
    return list
  }, [categories])

  React.useEffect(() => {
    setExpandedCategoryIds((current) => {
      if (current.has(activeCategoryId)) return current
      const next = new Set(current)
      next.add(activeCategoryId)
      return next
    })
  }, [activeCategoryId])

  const nodesByCategory = React.useMemo(() => {
    const map = new Map<string, typeof nodes>()
    for (const node of nodes) {
      const id = node.categoryId || 'shots'
      const list = map.get(id)
      if (list) list.push(node)
      else map.set(id, [node])
    }
    return map
  }, [nodes])

  const nodeById = React.useMemo(() => {
    const map = new Map<string, (typeof nodes)[number]>()
    for (const node of nodes) map.set(node.id, node)
    return map
  }, [nodes])

  const groupsByCategory = React.useMemo(() => {
    const map = new Map<string, typeof groups>()
    for (const group of groups) {
      const list = map.get(group.categoryId)
      if (list) list.push(group)
      else map.set(group.categoryId, [group])
    }
    return map
  }, [groups])

  const counts = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const [categoryId, list] of nodesByCategory) {
      map.set(categoryId, list.length)
    }
    return map
  }, [nodesByCategory])

  const toggleCategory = React.useCallback((categoryId: string) => {
    setExpandedCategoryIds((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  const handleActivateCategory = React.useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId)
    setExpandedCategoryIds((current) => {
      if (current.has(categoryId)) return current
      const next = new Set(current)
      next.add(categoryId)
      return next
    })
  }, [setActiveCategoryId])

  const handleSelectNode = React.useCallback((nodeId: string) => {
    selectNode(nodeId)
  }, [selectNode])

  const handleDropNodeOnCategory = React.useCallback((nodeId: string, categoryId: string) => {
    const node = nodeById.get(nodeId)
    if (!node) return
    if (node.categoryId === categoryId) {
      removeNodeFromGroup(nodeId)
      return
    }
    copyNodeToCategory(nodeId, categoryId)
  }, [copyNodeToCategory, nodeById, removeNodeFromGroup])

  const handleDropNodeOnGroup = React.useCallback((nodeId: string, groupId: string) => {
    const node = nodeById.get(nodeId)
    const group = groups.find((candidate) => candidate.id === groupId)
    if (!node || !group) return
    if (node.categoryId === group.categoryId) {
      moveNodeToGroup(nodeId, groupId)
      return
    }
    const copied = copyNodeToCategory(nodeId, group.categoryId)
    if (copied) moveNodeToGroup(copied.id, groupId)
  }, [copyNodeToCategory, groups, moveNodeToGroup, nodeById])

  return (
    <aside
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'flex flex-col h-full min-h-0 border-r border-nomi-line bg-nomi-paper',
        'transition-[width] duration-150 ease-out',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
      aria-label="项目分类"
    >
      <div className={cn('flex items-center px-2 py-2 border-b border-nomi-line', collapsed ? 'justify-center' : 'justify-between')}>
        {collapsed ? null : (
          <span className="text-[11px] uppercase tracking-wider text-nomi-ink-40">分类</span>
        )}
        <button
          type="button"
          onClick={toggle}
          className="text-nomi-ink-40 hover:text-nomi-ink p-1 rounded text-[12px]"
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
        {visible.map((cat) => {
          const categoryNodes = nodesByCategory.get(cat.id) || []
          const categoryGroups = groupsByCategory.get(cat.id) || []
          const groupedNodeIds = new Set(categoryGroups.flatMap((group) => group.nodeIds))
          const looseNodes = categoryNodes.filter((node) => !groupedNodeIds.has(node.id))
          const expanded = expandedCategoryIds.has(cat.id)
          return (
            <div key={cat.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="grid h-7 w-5 place-items-center rounded text-[10px] text-nomi-ink-40 hover:bg-nomi-ink-05 hover:text-nomi-ink"
                    aria-label={expanded ? `折叠${cat.name}` : `展开${cat.name}`}
                    aria-expanded={expanded}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <CategoryItem
                    category={cat}
                    count={counts.get(cat.id) || 0}
                    active={activeCategoryId === cat.id}
                    collapsed={collapsed}
                    onActivate={() => handleActivateCategory(cat.id)}
                    onDropNode={(nodeId) => handleDropNodeOnCategory(nodeId, cat.id)}
                  />
                </div>
              </div>
              {!collapsed && expanded ? (
                <div className="ml-5 flex flex-col gap-1 border-l border-nomi-line/70 pl-2">
                  {looseNodes.map((node) => (
                    <NodeItem
                      key={node.id}
                      node={node}
                      active={selectedNodeIds.includes(node.id)}
                      onSelect={handleSelectNode}
                    />
                  ))}
                  {categoryGroups.map((group) => {
                    const memberNodes = group.nodeIds.flatMap((nodeId) => {
                      const node = nodeById.get(nodeId)
                      return node && node.categoryId === group.categoryId ? [node] : []
                    })
                    return (
                      <GroupItem
                        key={group.id}
                        group={group}
                        nodes={memberNodes}
                        selectedNodeIds={selectedNodeIds}
                        onSelectNode={handleSelectNode}
                        onDropNode={handleDropNodeOnGroup}
                        onDropGroup={(activeGroupId, overGroupId) => reorderGroup(cat.id, activeGroupId, overGroupId)}
                      />
                    )
                  })}
                  {!looseNodes.length && !categoryGroups.length ? (
                    <div className="px-2 py-1.5 text-[11px] text-nomi-ink-30">暂无节点</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
      <div className={cn('px-2 py-2 border-t border-nomi-line', collapsed && 'hidden')}>
        <button
          type="button"
          disabled
          className={cn(
            'w-full px-2 py-1.5 text-[12px] rounded-md border border-dashed border-nomi-line',
            'text-nomi-ink-40 cursor-not-allowed',
          )}
          title="自定义分类将在 Phase F 落地"
        >
          + 新分类
        </button>
      </div>
    </aside>
  )
}
