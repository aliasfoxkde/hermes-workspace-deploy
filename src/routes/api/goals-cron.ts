import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

// Cron jobs are read from the Hermes cron subsystem.
// The goals dashboard shows which autonomous agents are running.
// Real cron data requires access to Hermes's internal cron store.
// For now, return empty — the cron jobs are visible via `hermes cron list` CLI.
