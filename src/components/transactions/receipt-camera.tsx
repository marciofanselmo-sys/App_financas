'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ImageUp, PencilLine, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkFrame, FrameCheck, Gray, toGray } from '@/lib/nfce-image'

interface Props {
  /** Foto tirada: o pedaço do vídeo dentro da moldura, na resolução cheia. */
  onCapture: (canvas: HTMLCanvasElement) => void
  onGallery: (file: File) => void
  onManual: () => void
  onCancel: () => void
}

const CHECKS: { key: keyof FrameCheck; label: string }[] = [
  { key: 'inteira', label: 'Nota inteira' },
  { key: 'reta', label: 'Reta' },
  { key: 'luz', label: 'Com luz' },
  { key: 'firme', label: 'Sem tremer' },
]

// Moldura: fração da área do vídeo (em pé, como a nota).
const GUIDE = { w: 0.62, h: 0.9 }
// Sem passar em tudo depois disso, libera "Tirar assim mesmo".
const FALLBACK_MS = 8000

/**
 * Câmera com moldura. A moldura fica verde quando a nota está inteira, reta,
 * com luz e parada — só então "Tirar foto" libera. Sem câmera (computador,
 * permissão negada), sobra a galeria e o preenchimento à mão.
 */
export function ReceiptCamera({ onCapture, onGallery, onManual, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'abrindo' | 'ok' | 'sem-camera'>('abrindo')
  const [checks, setChecks] = useState<FrameCheck>({ inteira: false, reta: false, luz: false, firme: false })
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setState('sem-camera'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play().catch(() => {})
        setState('ok')
      } catch {
        setState('sem-camera')
      }
    }
    start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Retângulo do vídeo (em pixels do vídeo) que aparece dentro da moldura.
  // O vídeo é exibido com object-cover: parte dele fica fora da caixa.
  function guideRect(margin = 0) {
    const v = videoRef.current, box = boxRef.current
    if (!v || !box || !v.videoWidth) return null
    const cw = box.clientWidth, ch = box.clientHeight
    const s = Math.max(cw / v.videoWidth, ch / v.videoHeight)
    const ox = (cw - v.videoWidth * s) / 2, oy = (ch - v.videoHeight * s) / 2
    const gw = cw * GUIDE.w * (1 + margin), gh = ch * GUIDE.h * (1 + margin)
    const gx = (cw - gw) / 2, gy = (ch - gh) / 2
    const x = Math.max(0, (gx - ox) / s), y = Math.max(0, (gy - oy) / s)
    return {
      x, y,
      w: Math.min(v.videoWidth - x, gw / s),
      h: Math.min(v.videoHeight - y, gh / s),
    }
  }

  // Checagem da moldura numa amostra pequena, algumas vezes por segundo.
  useEffect(() => {
    if (state !== 'ok') return
    const sample = document.createElement('canvas')
    sample.width = 120
    sample.height = 180
    const ctx = sample.getContext('2d', { willReadFrequently: true })!
    let prev: Gray | null = null
    const id = window.setInterval(() => {
      const r = guideRect()
      const v = videoRef.current
      if (!r || !v) return
      ctx.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, sample.width, sample.height)
      const g = toGray(ctx.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height)
      setChecks(checkFrame(g, prev))
      prev = g
    }, 350)
    const t = window.setTimeout(() => setFallback(true), FALLBACK_MS)
    return () => { window.clearInterval(id); window.clearTimeout(t) }
  }, [state])

  const allOk = CHECKS.every(c => checks[c.key])

  function capture() {
    const v = videoRef.current
    // Um pouco além da moldura, para não cortar a borda da nota.
    const r = guideRect(0.06)
    if (!v || !r) return
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(r.w)
    canvas.height = Math.round(r.h)
    canvas.getContext('2d')!.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height)
    onCapture(canvas)
  }

  return (
    <div className="space-y-3">
      {state === 'sem-camera' ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-6 py-10 text-center">
          <CameraOff className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Não conseguimos abrir a câmera</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Escolha uma foto da nota que já está no aparelho, ou preencha os itens à mão.
            No celular, confira se o navegador tem permissão para usar a câmera.
          </p>
          <Button className="mt-2" onClick={() => fileRef.current?.click()}>
            <ImageUp className="h-4 w-4 mr-2" />Escolher foto da nota
          </Button>
        </div>
      ) : (
        <>
          <div ref={boxRef} className="relative h-[52vh] max-h-[440px] min-h-[300px] overflow-hidden rounded-xl bg-slate-900">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            {/* Moldura: o escurecido em volta é a sombra dela. */}
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-[3px] transition-colors ${allOk ? 'border-green-500' : 'border-white/80'}`}
              style={{ width: `${GUIDE.w * 100}%`, height: `${GUIDE.h * 100}%`, boxShadow: '0 0 0 2000px rgba(0,0,0,0.38)' }}
            />
            <div className={`absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-white ${allOk ? 'bg-green-600' : 'bg-slate-900/70'}`}>
              {state === 'abrindo' ? 'Abrindo a câmera…' : allOk ? '✓ Nota enquadrada — pode tirar a foto' : 'Encaixe a nota inteira na moldura'}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CHECKS.map(c => (
              <div
                key={c.key}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${checks[c.key]
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}
              >
                {checks[c.key] ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                {c.label}
              </div>
            ))}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onGallery(f)
          e.target.value = ''
        }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <button type="button" onClick={onManual} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
          <PencilLine className="h-4 w-4" />Preencher à mão
        </button>
        {state !== 'sem-camera' && (
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <ImageUp className="h-4 w-4" />Escolher da galeria
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          {state !== 'sem-camera' && (
            <Button onClick={capture} disabled={state !== 'ok' || (!allOk && !fallback)}>
              <Camera className="h-4 w-4 mr-2" />{allOk || !fallback ? 'Tirar foto' : 'Tirar assim mesmo'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
