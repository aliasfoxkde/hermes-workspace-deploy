'use client'

// Goals data types
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

export interface CronJob {
  id: string
  name: string
  schedule: string
  next_run: string
  last_run?: string
  last_status?: 'ok' | 'error' | 'paused'
  enabled: boolean
  category: 'research' | 'health' | 'quality' | 'sync' | 'learning' | 'backend'
}

export interface GoalBoard {
  goals: Goal[]
  cronJobs: CronJob[]
  stats: {
    total: number
    planned: number
    in_progress: number
    completed: number
    blocked: number
  }
}

// Fetch goals from the API
export async function fetchGoals(): Promise<GoalBoard> {
  const res = await fetch('/api/goals')
  if (!res.ok) throw new Error('Failed to fetch goals')
  return res.json()
}

// Fetch only cron jobs
export async function fetchCronJobs(): Promise<CronJob[]> {
  const res = await fetch('/api/goals/cron')
  if (!res.ok) throw new Error('Failed to fetch cron jobs')
  return res.json()
}

// Update a goal
export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
  const res = await fetch(`/api/goals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update goal')
  return res.json()
}

// Create a goal
export async function createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal> {
  const res = await fetch('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(goal),
  })
  if (!res.ok) throw new Error('Failed to create goal')
  return res.json()
}

// Delete a goal
export async function deleteGoal(id: string): Promise<void> {
  const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete goal')
}

// Priority colors
export const PRIORITY_COLORS: Record<Goal['priority'], string> = {
  P0: 'text-red-400',
  P1: 'text-orange-400',
  P2: 'text-yellow-400',
  P3: 'text-blue-400',
}

// Status colors
export const STATUS_COLORS: Record<Goal['status'], string> = {
  planned: 'bg-slate-600',
  in_progress: 'bg-blue-600',
  completed: 'bg-green-600',
  blocked: 'bg-red-600',
}

// Category colors
export const CATEGORY_COLORS: Record<Goal['category'], string> = {
  feature: 'text-purple-400',
  research: 'text-cyan-400',
  improvement: 'text-emerald-400',
  bugfix: 'text-red-400',
  infrastructure: 'text-slate-400',
}
