'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/error-reporter'

/**
 * Captura erros que ninguém tratou — a tela que explode com uma exceção
 * inesperada, ou uma promessa rejeitada sem catch — e registra em app_errors.
 *
 * Complementa logSafeError, que cobre os erros PREVISTOS (o banco recusou uma
 * gravação, a importação falhou). Os imprevistos são exatamente os que ninguém
 * saberia que existem.
 */
export function ErrorListener() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportError('window.error', event.error ?? event.message)
    }
    function onRejection(event: PromiseRejectionEvent) {
      reportError('window.unhandledrejection', event.reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
