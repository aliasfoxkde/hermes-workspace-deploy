import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addGoal,
  deleteGoal,
  getDefaultGoals,
  getGoalsStats,
  loadGoals,
  updateGoal,
  type Goal,
} from '../../server/goals-store'

const CreateGoalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  status: z.enum(['planned', 'in_progress', 'completed', 'blocked']).optional().default('planned'),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().default('P2'),
  category: z.enum(['feature', 'research', 'improvement', 'bugfix', 'infrastructure']).optional().default('feature'),
  source: z.enum(['manual', 'cron', 'delegate', 'research']).optional().default('manual'),
  assignee: z.string().trim().max(100).optional(),
  labels: z.array(z.string()).optional().default([]),
  block_reason: z.string().trim().max(500).optional(),
  depends_on: z.array(z.string()).optional().default([]),
})

const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  id: z.string().trim().min(1),
})

export const Route = createFileRoute('/api/goals')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const includeDefaults = url.searchParams.get('include_defaults') !== 'false'

        let goals: Goal[] = loadGoals()

        // Merge with defaults if no goals exist
        if (goals.length === 0 && includeDefaults) {
          goals = getDefaultGoals()
        }

        return json({
          goals,
          stats: getGoalsStats(goals),
        })
      },

      POST: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
        }

        const parsed = CreateGoalSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
            { status: 400 }
          )
        }

        const goal = addGoal(parsed.data)
        return json({ ok: true, goal }, { status: 201 })
      },

      PATCH: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
        }

        const parsed = UpdateGoalSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
            { status: 400 }
          )
        }

        const { id, ...updates } = parsed.data
        const updated = updateGoal(id, updates)
        if (!updated) {
          return json({ ok: false, error: 'Goal not found' }, { status: 404 })
        }

        return json({ ok: true, goal: updated })
      },

      DELETE: async ({ request }) => {
        const url = new URL(request.url)
        const id = url.searchParams.get('id')
        if (!id) {
          return json({ ok: false, error: 'Missing goal id' }, { status: 400 })
        }

        const deleted = deleteGoal(id)
        if (!deleted) {
          return json({ ok: false, error: 'Goal not found' }, { status: 404 })
        }

        return json({ ok: true })
      },
    },
  },
})
