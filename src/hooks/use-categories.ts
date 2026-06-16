'use client'

import { useState, useEffect } from 'react'
import { Category, DEFAULT_CATEGORIES } from '@/types'

const STORAGE_KEY = 'financeapp_categories'

function load(): Category[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Category[]
  } catch {}
  return []
}

function save(cats: Category[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats))
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = load()
    if (stored.length > 0) {
      setCategories(stored)
    } else {
      const defaults = DEFAULT_CATEGORIES.map(c => ({
        ...c,
        id: uid(),
        user_id: 'local',
        created_at: new Date().toISOString(),
      }))
      save(defaults)
      setCategories(defaults)
    }
    setLoading(false)
  }, [])

  function persist(cats: Category[]) {
    save(cats)
    setCategories(cats)
  }

  async function createCategory(cat: Omit<Category, 'id' | 'user_id' | 'created_at'>) {
    const duplicate = categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase())
    if (duplicate) return { error: 'Já existe uma categoria com esse nome.' }

    const newCat: Category = {
      ...cat,
      id: uid(),
      user_id: 'local',
      created_at: new Date().toISOString(),
    }
    persist([...categories, newCat])
    return { error: null }
  }

  async function updateCategory(id: string, cat: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>) {
    persist(categories.map(c => (c.id === id ? { ...c, ...cat } : c)))
    return { error: null }
  }

  async function deleteCategory(id: string) {
    persist(categories.filter(c => c.id !== id))
    return { error: null }
  }

  async function seedDefaults() {
    const existing = categories.map(c => c.name.toLowerCase())
    const toAdd = DEFAULT_CATEGORIES
      .filter(c => !existing.includes(c.name.toLowerCase()))
      .map(c => ({
        ...c,
        id: uid(),
        user_id: 'local',
        created_at: new Date().toISOString(),
      }))

    if (toAdd.length === 0) return { error: null }
    persist([...categories, ...toAdd])
    return { error: null }
  }

  return {
    categories,
    loading,
    refetch: () => {},
    createCategory,
    updateCategory,
    deleteCategory,
    seedDefaults,
  }
}
