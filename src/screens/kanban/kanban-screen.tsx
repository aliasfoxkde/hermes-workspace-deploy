'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckListIcon,
  RefreshIcon,
  DashboardSquareIcon,
} from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type SwarmKanbanLane = 'backlog' | 'ready' | 'running' | 'review' | 'blocked' | 'done'

type SwarmKanbanCard = {
  id: string
  title: string
  spec: string
  acceptanceCriteria: string[]
  assignedWorker: string | null
  reviewer: string | null
  status: SwarmKanbanLane
  missionId: string | null
  reportPath: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
}

type KanbanBackendMeta = {
  id: 'local' | 'claude'
  label: string
  detected: boolean
  writable: boolean
  details?: string | null
  path?: string | null
}

type KanbanResponse = {
  cards?: Array<SwarmKanbanCard>
  backend?: KanbanBackendMeta
}

// ── Hermes Kanban column display (maps swarm lanes → Hermes columns) ─────────────

type HermesColumn = {
  id: SwarmKanbanLane
  label: string
  hermesLabel: string
  hint: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
}

const COLUMNS: HermesColumn[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    hermesLabel: 'triage · todo',
    hint: 'Raw ideas, not yet ready for work',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-400/30',
    textColor: 'text-slate-400',
  },
  {
    id: 'ready',
    label: 'Ready',
    hermesLabel: 'ready',
    hint: 'Spec clear, waiting to be picked up',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-400/30',
    textColor: 'text-blue-400',
  },
  {
    id: 'running',
    label: 'Running',
    hermesLabel: 'running',
    hint: 'Worker actively executing',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-400/30',
    textColor: 'text-emerald-400',
  },
  {
    id: 'review',
    label: 'Review',
    hermesLabel: '—',
    hint: 'Needs peer or human review',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-400/30',
    textColor: 'text-violet-400',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    hermesLabel: 'blocked',
    hint: 'Waiting on dependency or input',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-400/30',
    textColor: 'text-red-400',
  },
  {
    id: 'done',
    label: 'Done',
    hermesLabel: 'done',
    hint: 'Completed and accepted',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-400/30',
    textColor: 'text-green-400',
  },
]

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchKanbanCards(): Promise<KanbanResponse> {
  const res = await fetch('/api/swarm-kanban')
  if (!res.ok) throw new Error(`Kanban request failed: ${res.status}`)
  return res.json() as Promise<KanbanResponse>
}

async function createKanbanCard(input: {
  title: string
  spec: string
  acceptanceCriteria: string[]
  assignedWorker: string | null
  status: SwarmKanbanLane
}): Promise<SwarmKanbanCard> {
  const res = await fetch('/api/swarm-kanban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; card?: SwarmKanbanCard; error?: string }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Create failed: ${res.status}`)
  if (!data.card) throw new Error('No card returned')
  return data.card
}

async function updateKanbanCard(id: string, updates: Partial<SwarmKanbanCard>): Promise<SwarmKanbanCard> {
  const res = await fetch('/api/swarm-kanban', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; card?: SwarmKanbanCard; error?: string }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Update failed: ${res.status}`)
  if (!data.card) throw new Error('Card not found')
  return data.card
}

// ── Card component ─────────────────────────────────────────────────────────────

function Card({
  card,
  onStatusChange,
  onDelete,
}: {
  card: SwarmKanbanCard
  onStatusChange: (id: string, status: SwarmKanbanLane) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const createdDate = useMemo(
    () => (card.createdAt ? new Date(card.createdAt).toLocaleDateString() : '—'),
    [card.createdAt],
  )

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="group relative rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex-1 text-sm font-medium leading-snug text-[var(--theme-text)]">
          {card.title}
        </h3>
        {/* Status change + menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg border border-transparent px-1.5 py-0.5 text-xs opacity-0 transition-all group-hover:opacity-100 hover:border-[var(--theme-border)] hover:bg-[var(--theme-card2)]"
          >
            <HugeiconsIcon icon={DashboardSquareIcon} size={12} className="text-[var(--theme-muted)]" />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-6 z-20 w-44 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-1 shadow-xl"
            >
              <div className="mb-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                Move to
              </div>
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => { onStatusChange(card.id, col.id); setMenuOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                    card.status === col.id
                      ? 'bg-[var(--theme-accent)]/20 font-semibold text-[var(--theme-accent)]'
                      : 'text-[var(--theme-text)] hover:bg-[var(--theme-hover)]',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', col.bgColor.replace('/10', ''))} />
                  {col.label}
                </button>
              ))}
              <div className="my-1 border-t border-[var(--theme-border)]" />
              <button
                type="button"
                onClick={() => { onDelete(card.id); setMenuOpen(false) }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
              >
                Archive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Spec */}
      {card.spec && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--theme-muted-2)] line-clamp-2">
          {card.spec}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap gap-1">
          {card.acceptanceCriteria.length > 0 && (
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
              {card.acceptanceCriteria.length} criteria
            </span>
          )}
          {card.reviewer && (
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              reviewer: {card.reviewer}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {card.assignedWorker && (
            <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
              {card.assignedWorker}
            </span>
          )}
          <span className="text-[10px] text-[var(--theme-muted)]">{createdDate}</span>
        </div>
      </div>
    </div>
  )
}

// ── New card composer ─────────────────────────────────────────────────────────

function NewCardComposer({
  onClose,
  onSubmit,
  defaultStatus,
}: {
  onClose: () => void
  onSubmit: (data: { title: string; spec: string; assignedWorker: string | null; status: SwarmKanbanLane }) => void
  defaultStatus?: SwarmKanbanLane
}) {
  const [title, setTitle] = useState('')
  const [spec, setSpec] = useState('')
  const [worker, setWorker] = useState('')
  const [status, setStatus] = useState<SwarmKanbanLane>(defaultStatus ?? 'backlog')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({ title: title.trim(), spec: spec.trim(), assignedWorker: worker || null, status })
    onClose()
  }

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--theme-muted)]">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--theme-muted)]">Spec / Description</label>
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            rows={3}
            placeholder="Task details, context, links..."
            className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-[var(--theme-muted)]">Assignee</label>
            <input
              value={worker}
              onChange={(e) => setWorker(e.target.value)}
              placeholder="default"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-semibold text-[var(--theme-muted)]">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SwarmKanbanLane)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
            >
              {COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>{col.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-semibold text-primary-950 transition-colors hover:bg-[var(--theme-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create card
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function KanbanScreen() {
  const queryClient = useQueryClient()
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerStatus, setComposerStatus] = useState<SwarmKanbanLane>('backlog')
  const [backendToast, setBackendToast] = useState<KanbanBackendMeta | null>(null)
  const lastToastKey = useRef<string | null>(null)

  const query = useQuery({
    queryKey: ['kanban', 'board'],
    queryFn: fetchKanbanCards,
    refetchInterval: 15_000,
    staleTime: 5_000,
  })

  const createMutation = useMutation({
    mutationFn: createKanbanCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['kanban', 'board'] })
      toast.success('Card created')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SwarmKanbanCard> }) =>
      updateKanbanCard(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['kanban', 'board'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Show backend toast once per session
  useEffect(() => {
    const backend = query.data?.backend
    if (!backend) return
    const key = `${backend.id}:${backend.detected}`
    if (lastToastKey.current === key) return
    lastToastKey.current = key
    setBackendToast(backend)
    const t = setTimeout(() => setBackendToast(null), 5000)
    return () => clearTimeout(t)
  }, [query.data?.backend])

  const cardsByLane = useMemo(() => {
    const map = new Map<SwarmKanbanLane, SwarmKanbanCard[]>()
    for (const col of COLUMNS) map.set(col.id, [])
    for (const card of query.data?.cards ?? []) {
      const bucket = map.get(card.status as SwarmKanbanLane) ?? map.get('backlog')!
      bucket.push(card)
    }
    return map
  }, [query.data])

  const handleStatusChange = useCallback(
    (id: string, status: SwarmKanbanLane) => {
      updateMutation.mutate({ id, updates: { status } })
    },
    [updateMutation],
  )

  const handleDelete = useCallback(
    (id: string) => {
      updateMutation.mutate({ id, updates: { status: 'done' } })
    },
    [updateMutation],
  )

  const totalCards = query.data?.cards?.length ?? 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HugeiconsIcon icon={CheckListIcon} size={20} className="text-[var(--theme-accent)]" />
            <div>
              <h1 className="text-base font-semibold text-[var(--theme-text)]">Hermes Kanban</h1>
              <p className="text-xs text-[var(--theme-muted)]">
                {totalCards} card{totalCards !== 1 ? 's' : ''} across {COLUMNS.length} columns
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Backend badge */}
            {query.data?.backend && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  query.data.backend.id === 'claude'
                    ? 'border-violet-400/40 bg-violet-500/10 text-violet-400'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-400',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    query.data.backend.id === 'claude' ? 'bg-violet-400' : 'bg-amber-400',
                  )}
                />
                {query.data.backend.id === 'claude' ? 'Hermes Kanban' : 'Local board'}
              </span>
            )}
            <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1 text-xs text-[var(--theme-muted)]">
              {cardsByLane.get('blocked')?.length ?? 0} blocked
            </span>
            <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1 text-xs text-[var(--theme-muted)]">
              {cardsByLane.get('running')?.length ?? 0} running
            </span>
            <button
              type="button"
              onClick={() => { void query.refetch() }}
              disabled={query.isFetching}
              className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] p-1.5 text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)] disabled:opacity-50"
              title="Refresh"
            >
              <HugeiconsIcon icon={RefreshIcon} size={14} className={query.isFetching ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="rounded-full bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-semibold text-primary-950 transition-colors hover:bg-[var(--theme-accent-strong)]"
            >
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Add01Icon} size={13} />
                New card
              </span>
            </button>
          </div>
        </div>

        {/* Backend toast */}
        <AnimatePresence>
          {backendToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-2 flex items-start gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
              <span className="text-violet-300">
                {backendToast.id === 'claude'
                  ? `Connected to Hermes Kanban: ${backendToast.path ?? '~/.hermes/kanban.db'}`
                  : `Using local fallback board. ${backendToast.details ?? ''}`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Board */}
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden">
        {query.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-accent)] border-r-transparent" />
          </div>
        ) : query.isError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-red-400">
            Failed to load: {query.error instanceof Error ? query.error.message : 'Unknown error'}
          </div>
        ) : (
          <div className="flex h-full w-max min-w-0 flex-1 gap-3 p-4">
            {COLUMNS.map((col) => {
              const cards = cardsByLane.get(col.id) ?? []
              return (
                <div key={col.id} className="flex h-full w-72 shrink-0 flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                  {/* Column header */}
                  <div className="shrink-0 border-b border-[var(--theme-border)] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', col.bgColor.replace('/10', ''))} />
                        <span className="text-xs font-semibold text-[var(--theme-text)]">{col.label}</span>
                        <span className="rounded-full bg-[var(--theme-bg)] px-1.5 py-0.5 text-[10px] text-[var(--theme-muted)]">
                          {cards.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setComposerStatus(col.id); setComposerOpen(true) }}
                        className="rounded-lg border border-transparent p-1 text-[var(--theme-muted)] opacity-0 transition-all group-hover/section:opacity-100 hover:border-[var(--theme-border)] hover:bg-[var(--theme-card)] hover:text-[var(--theme-text)]"
                        title={`Add to ${col.label}`}
                      >
                        <HugeiconsIcon icon={Add01Icon} size={12} />
                      </button>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">{col.hint}</p>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cards.map((card) => (
                      <Card
                        key={card.id}
                        card={card}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-xs text-[var(--theme-muted)]">No cards</p>
                        <button
                          type="button"
                          onClick={() => { setComposerStatus(col.id); setComposerOpen(true) }}
                          className="mt-2 rounded-lg border border-dashed border-[var(--theme-border)] px-3 py-1.5 text-xs text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                        >
                          + Add card
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New card modal */}
      <AnimatePresence>
        {composerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setComposerOpen(false) }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-lg"
            >
              <NewCardComposer
                defaultStatus={composerStatus}
                onClose={() => setComposerOpen(false)}
                onSubmit={(data) => createMutation.mutate(data)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
