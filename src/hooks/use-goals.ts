'use client'

import { useState, useEffect } from 'react'
import { Goal } from '@/types'

const STORAGE_KEY = 'financeapp_goals'

function load(): Goal[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Goal[]
  } catch {}
  return []
}

function save(goals: Goal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setGoals(load())
    setLoading(false)
  }, [])

  function persist(gs: Goal[]) {
    save(gs)
    setGoals(gs)
  }

  function createGoal(goal: Omit<Goal, 'id' | 'created_at'>) {
    const newGoal: Goal = { ...goal, id: uid(), created_at: new Date().toISOString() }
    persist([...goals, newGoal])
  }

  function updateGoal(id: string, data: Partial<Omit<Goal, 'id' | 'created_at'>>) {
    persist(goals.map(g => (g.id === id ? { ...g, ...data } : g)))
  }

  function deleteGoal(id: string) {
    persist(goals.filter(g => g.id !== id))
  }

  return { goals, loading, createGoal, updateGoal, deleteGoal }
}
