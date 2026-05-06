'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  RefreshIcon,
  PlayCircle02Icon,
  FilterHorizontalIcon,
  BitcoinTargetIcon,
  TwentyFourHoursClockIcon,
  CheckListIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, STATUS_COLORS, CATEGORY_COLORS, type Goal } from '@/lib/goals-api'
import { fetchGoals, updateGoal, createGoal, deleteGoal } from '@/lib/goals-api'
import { toast } from '@/components/ui/toast'

const STATUS_ORDER = ['planned', 'in_progress', 'completed', 'blocked'] as const
const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}
const STATUS_ICONS: Record<string, any> = {
  planned: BitcoinTargetIcon,
  in_progress: PlayCircle02Icon,
  completed: CheckmarkCircle02Icon,
  blocked: Delete01Icon,
}

function GoalCard({ goal, onUpdate, onDelete }: { goal: Goal; onUpdate: (g: Goal) => void; onDelete: (id: string) => void }) {
  const [showActions, setShowActions] = useState(false)
  const StatusIcon = STATUS_ICONS[goal.status] || BitcoinTargetIcon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 cursor-pointer',
        'hover:border-[var(--theme-hover)] transition-colors',
        'select-none'
      )}
      onClick={() => setShowActions(!showActions)}
    >
      {/* Header: Priority + Category */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-mono font-bold', PRIORITY_COLORS[goal.priority])}>
          {goal.priority}
        </span>
        <span className={cn('text-xs', CATEGORY_COLORS[goal.category])}>
          {goal.category}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-[var(--theme-text)] mb-1 line-clamp-2">
        {goal.title}
      </h4>

      {/* Description */}
      {goal.description && (
        <p className="text-xs text-[var(--theme-text-secondary)] mb-2 line-clamp-2">
          {goal.description}
        </p>
      )}

      {/* Labels */}
      {goal.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {goal.labels.map((label) => (
            <span
              key={label}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-hover)] text-[var(--theme-text-secondary)]"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Block reason */}
      {goal.status === 'blocked' && goal.block_reason && (
        <p className="text-xs text-red-400 mb-2 italic">Blocked: {goal.block_reason}</p>
      )}

      {/* Actions (shown on click) */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--theme-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Status change */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate({ ...goal, status: s })}
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded transition-colors',
                    goal.status === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--theme-hover)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-border)]'
                  )}
                  title={STATUS_LABELS[s]}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* Delete */}
            <button
              onClick={() => {
                onDelete(goal.id)
                toast({ title: 'Goal deleted', variant: 'default' })
              }}
              className="ml-auto text-red-400 hover:text-red-300 transition-colors"
              title="Delete goal"
            >
              <HugeiconsIcon icon={Delete01Icon} className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source badge */}
      <div className="flex items-center gap-1 mt-1.5">
        <HugeiconsIcon
          icon={goal.source === 'cron' ? TwentyFourHoursClockIcon : goal.source === 'delegate' ? CheckListIcon : BitcoinTargetIcon}
          className="w-3 h-3 text-[var(--theme-text-secondary)]"
        />
        <span className="text-[10px] text-[var(--theme-text-secondary)]">{goal.source}</span>
      </div>
    </motion.div>
  )
}

function CreateGoalDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Goal['priority']>('P2')
  const [category, setCategory] = useState<Goal['category']>('feature')
  const [labels, setLabels] = useState('')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[var(--theme-text)] mb-4">New Goal</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--theme-text-secondary)] mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-secondary)] focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-[var(--theme-text-secondary)] mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, context, links..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-secondary)] focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-[var(--theme-text-secondary)] mb-1 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Goal['priority'])}
                className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] focus:outline-none focus:border-blue-500"
              >
                <option value="P0">P0 — Critical</option>
                <option value="P1">P1 — High</option>
                <option value="P2">P2 — Medium</option>
                <option value="P3">P3 — Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-[var(--theme-text-secondary)] mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Goal['category'])}
                className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] focus:outline-none focus:border-blue-500"
              >
                <option value="feature">Feature</option>
                <option value="research">Research</option>
                <option value="improvement">Improvement</option>
                <option value="bugfix">Bugfix</option>
                <option value="infrastructure">Infrastructure</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--theme-text-secondary)] mb-1 block">Labels (comma-separated)</label>
            <input
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="ui, terminal, kanban..."
              className="w-full px-3 py-2 rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-secondary)] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--theme-text-secondary)] hover:text-[var(--theme-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!title.trim()) return
              onCreate({
                title: title.trim(),
                description: description.trim(),
                status: 'planned',
                priority,
                category,
                source: 'manual',
                labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
                depends_on: [],
              })
              setTitle('')
              setDescription('')
              setLabels('')
              onClose()
            }}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Create Goal
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function GoalsScreen() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: fetchGoals,
    refetchInterval: 60000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Goal> }) =>
      updateGoal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      toast({ title: 'Goal updated', variant: 'default' })
    },
  })

  const createMutation = useMutation({
    mutationFn: (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => createGoal(goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      toast({ title: 'Goal created', variant: 'default' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  const goals = data?.goals ?? []

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (statusFilter && g.status !== statusFilter) return false
      if (categoryFilter && g.category !== categoryFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          g.title.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.labels.some((l) => l.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [goals, statusFilter, categoryFilter, searchQuery])

  const goalsByStatus = useMemo(() => {
    const map: Record<string, Goal[]> = {}
    for (const s of STATUS_ORDER) {
      map[s] = filteredGoals.filter((g) => g.status === s)
    }
    return map
  }, [filteredGoals])

  const stats = data?.stats

  const handleUpdate = useCallback(
    (updates: Partial<Goal>) => {
      if (!updates.id) return
      updateMutation.mutate({ id: updates.id, updates })
    },
    [updateMutation]
  )

  const handleCreate = useCallback(
    (goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => {
      createMutation.mutate(goal)
    },
    [createMutation]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id)
    },
    [deleteMutation]
  )

  const categories = useMemo(() => {
    const cats = new Set(goals.map((g) => g.category))
    return Array.from(cats).sort()
  }, [goals])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--theme-text)]">Goals</h1>
          {stats && (
            <div className="flex items-center gap-2 text-xs text-[var(--theme-text-secondary)]">
              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-white">{stats.total}</span>
              <span>{stats.in_progress} active</span>
              <span>{stats.completed} done</span>
              {stats.blocked > 0 && <span className="text-red-400">{stats.blocked} blocked</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search goals..."
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-secondary)] focus:outline-none focus:border-blue-500 w-48"
          />

          {/* Category filter */}
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="px-2 py-1.5 text-xs rounded-lg bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg px-1 py-0.5">
            <button
              onClick={() => setStatusFilter(null)}
              className={cn('px-2 py-1 text-xs rounded transition-colors', !statusFilter ? 'bg-blue-600 text-white' : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-hover)]')}
            >
              All
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s === statusFilter ? null : s)}
                className={cn('px-2 py-1 text-xs rounded transition-colors', statusFilter === s ? 'bg-blue-600 text-white' : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-hover)]')}
              >
                {STATUS_LABELS[s].split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-[var(--theme-hover)] text-[var(--theme-text-secondary)] transition-colors"
            title="Refresh"
          >
            <HugeiconsIcon icon={RefreshIcon} className="w-4 h-4" />
          </button>

          {/* Add */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
            Add Goal
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[var(--theme-text-secondary)]">
            Loading goals...
          </div>
        ) : (
          <div className="flex gap-4 p-4 h-full" style={{ minWidth: `${STATUS_ORDER.length * 280}px` }}>
            {STATUS_ORDER.map((status) => {
              const colGoals = goalsByStatus[status] || []
              const StatusIcon = STATUS_ICONS[status]

              return (
                <div key={status} className="flex flex-col w-[280px] shrink-0 h-full">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={StatusIcon} className="w-4 h-4 text-[var(--theme-text-secondary)]" />
                      <span className="text-sm font-medium text-[var(--theme-text)]">
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs text-[var(--theme-text-secondary)] bg-[var(--theme-hover)] px-1.5 py-0.5 rounded">
                        {colGoals.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    <AnimatePresence mode="popLayout">
                      {colGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                        />
                      ))}
                    </AnimatePresence>

                    {colGoals.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-[var(--theme-text-secondary)] text-xs">
                        <HugeiconsIcon icon={StatusIcon} className="w-8 h-8 mb-2 opacity-30" />
                        No goals
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateGoalDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
