import React, { useEffect, useState } from 'react'
import { Card } from '../components/ui/card'

export default function CodexUploads() {
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    fetch('/uploads/codex_return_of_the_first_sorcerer.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load uploads (${r.status})`)
        return r.json()
      })
      .then((json) => {
        if (!canceled) setData(json)
      })
      .catch((err) => {
        if (!canceled) setError(String(err))
      })
    return () => {
      canceled = true
    }
  }, [])

  if (error) {
    return <div className="p-6">Failed to load uploads: {error}</div>
  }

  if (!data) return <div className="p-6">Carregando...</div>

  const { characters = [], locations = [], systems = {} } = data

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Codex Uploads (Preview)</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">Characters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((c: any) => (
            <Card key={c.id} className="p-4">
              <h3 className="text-lg font-medium">{c.name}</h3>
              <p className="text-sm text-muted-foreground">{c.position}</p>
              {c.manaRing && <p className="text-sm">Mana: {c.manaRing}</p>}
              {c.notes && <p className="mt-2 text-sm">{c.notes}</p>}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Locations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((l: any) => (
            <Card key={l.id} className="p-4">
              <h3 className="text-lg font-medium">{l.name}</h3>
              <p className="text-sm text-muted-foreground">{l.type}</p>
              {l.description && <p className="mt-2 text-sm">{l.description}</p>}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Systems</h2>
        <pre className="bg-surface p-4 rounded">{JSON.stringify(systems, null, 2)}</pre>
      </section>
    </div>
  )
}
