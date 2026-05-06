/**
 * Goals store — persists to ~/.hermes/goals.json
 * Combines manual goals with cron job status for a unified view.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface Goal {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'completed' | 'blocked'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  category: 'feature' | 'research' | 'improvement' | 'bugfix' | 'infrastructure'
  created_at: string
  updated_at: string
  source: 'manual' | 'cron' | 'delegate' | 'research'
  assignee?: string
  labels: string[]
  block_reason?: string
  depends_on: string[]
}

export interface CronJobInfo {
  id: string
  name: string
  schedule: string
  next_run: string
  last_run?: string
  last_status?: string
  enabled: boolean
  category: 'research' | 'health' | 'quality' | 'sync' | 'learning' | 'backend'
}

function goalsPath(): string {
  return join(homedir(), '.hermes', 'goals.json')
}

function ensureFile(): void {
  const p = goalsPath()
  if (!existsSync(p)) {
    const dir = join(homedir(), '.hermes')
    if (!existsSync(dir)) return
    writeFileSync(p, JSON.stringify({ goals: [], updated_at: new Date().toISOString() }, null, 2))
  }
}

export function loadGoals(): Goal[] {
  ensureFile()
  try {
    const raw = readFileSync(goalsPath(), 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data.goals) ? data.goals : []
  } catch {
    return []
  }
}

export function saveGoals(goals: Goal[]): void {
  ensureFile()
  writeFileSync(
    goalsPath(),
    JSON.stringify({ goals, updated_at: new Date().toISOString() }, null, 2)
  )
}

export function addGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Goal {
  const goals = loadGoals()
  const now = new Date().toISOString()
  const newGoal: Goal = {
    ...goal,
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: now,
    updated_at: now,
    labels: goal.labels ?? [],
    depends_on: goal.depends_on ?? [],
  }
  goals.push(newGoal)
  saveGoals(goals)
  return newGoal
}

export function updateGoal(id: string, updates: Partial<Goal>): Goal | null {
  const goals = loadGoals()
  const idx = goals.findIndex((g) => g.id === id)
  if (idx === -1) return null
  goals[idx] = { ...goals[idx], ...updates, updated_at: new Date().toISOString() }
  saveGoals(goals)
  return goals[idx]
}

export function deleteGoal(id: string): boolean {
  const goals = loadGoals()
  const idx = goals.findIndex((g) => g.id === id)
  if (idx === -1) return false
  goals.splice(idx, 1)
  saveGoals(goals)
  return true
}

export function getGoalsStats(goals: Goal[]) {
  return {
    total: goals.length,
    planned: goals.filter((g) => g.status === 'planned').length,
    in_progress: goals.filter((g) => g.status === 'in_progress').length,
    completed: goals.filter((g) => g.status === 'completed').length,
    blocked: goals.filter((g) => g.status === 'blocked').length,
  }
}

// Default goals from the Hermes system
export function getDefaultGoals(): Goal[] {
  return [
    {
      id: 'goal_default_1',
      title: 'Sessions UI overhaul',
      description: 'Date grouping, favorites, descriptive labels, independent scrollbar',
      status: 'planned',
      priority: 'P1',
      category: 'improvement',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['ui', 'sessions', 'workspace'],
      depends_on: [],
    },
    {
      id: 'goal_default_2',
      title: 'Terminal enhancements',
      description: 'Swipe commands, autofill, virtual keyboard, Termius-like experience',
      status: 'planned',
      priority: 'P1',
      category: 'feature',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['terminal', 'ui', 'workspace'],
      depends_on: [],
    },
    {
      id: 'goal_default_3',
      title: 'Fix compression model error',
      description: 'ZAI endpoint mismatch + glm-5-turbo → glm-5.1 fix',
      status: 'in_progress',
      priority: 'P0',
      category: 'bugfix',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['compression', 'zai', 'bugfix'],
      depends_on: [],
    },
    {
      id: 'goal_default_4',
      title: 'Expand Skills + MCP servers/tools',
      description: 'Add MCP server integration, expand skills system',
      status: 'planned',
      priority: 'P2',
      category: 'feature',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['skills', 'mcp', 'workspace'],
      depends_on: [],
    },
    {
      id: 'goal_default_5',
      title: 'Kanban v2 — multi-project system',
      description: 'Each GitHub repo = own board, filters, GitHub integration, Hermes goals board',
      status: 'planned',
      priority: 'P1',
      category: 'feature',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['kanban', 'github', 'projects'],
      depends_on: [],
    },
    {
      id: 'goal_default_6',
      title: 'Test & code coverage 90%+',
      description: 'Ruff audit, quality gates, systematic coverage improvement',
      status: 'planned',
      priority: 'P1',
      category: 'quality',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'cron',
      labels: ['testing', 'coverage', 'quality'],
      depends_on: [],
    },
    {
      id: 'goal_default_7',
      title: 'Build computer-use agent',
      description: 'Docker ephemeral containers for shell + browser tasks',
      status: 'in_progress',
      priority: 'P2',
      category: 'feature',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['docker', 'computer-use', 'agent'],
      depends_on: [],
    },
    {
      id: 'goal_default_8',
      title: 'Design Hermes computer-use tool',
      description: 'Spawn container, execute task, return result',
      status: 'planned',
      priority: 'P2',
      category: 'feature',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['docker', 'computer-use', 'design'],
      depends_on: ['goal_default_7'],
    },
    {
      id: 'goal_default_9',
      title: 'Plan concurrency improvements',
      description: 'Parallel sub-agents, ZAI key load balancing',
      status: 'planned',
      priority: 'P2',
      category: 'improvement',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['concurrency', 'zai', 'performance'],
      depends_on: [],
    },
    {
      id: 'goal_default_10',
      title: 'Design routing v2',
      description: 'Health-probed model selection, free-tier utilization',
      status: 'planned',
      priority: 'P2',
      category: 'improvement',
      created_at: '2026-05-06T17:00:00Z',
      updated_at: '2026-05-06T17:00:00Z',
      source: 'manual',
      labels: ['routing', 'health', 'performance'],
      depends_on: [],
    },
  ]
}
