import { createFileRoute, Outlet } from '@tanstack/react-router'
import { GoalsScreen } from '../screens/goals/goals-screen'

export const Route = createFileRoute('/goals')({
  component: GoalsScreen,
})
