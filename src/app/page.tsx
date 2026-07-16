import MultiMinerDashboard from '@/components/MultiMinerDashboard'

const DEFAULT_HOTKEY = '5HGr6joke42gGZxMHsDTuJEepnmbaihM7KdUwVtq2kA6TNAN'
const SS58_REGEX = /^5[A-HJ-NP-Za-km-z1-9]{47}$/

interface PageProps {
  searchParams: Promise<{ hotkey?: string | string[] }>
}

// Accept both ?hotkey=a,b,c (comma-list) and ?hotkey=a&hotkey=b (repeated).
function parseHotkeysFromUrl(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  const items = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  for (const item of items) {
    for (const part of item.split(',')) {
      const t = part.trim()
      if (t && SS58_REGEX.test(t) && !out.includes(t)) out.push(t)
    }
  }
  return out
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const urlHotkeys = parseHotkeysFromUrl(params.hotkey)
  const envDefault = process.env.NEXT_PUBLIC_DEFAULT_HOTKEY?.trim() || DEFAULT_HOTKEY
  return (
    <main>
      <MultiMinerDashboard urlHotkeys={urlHotkeys} fallbackHotkey={envDefault} />
    </main>
  )
}
