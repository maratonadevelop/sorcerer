import React, { useState } from 'react';

export default function CodexSystemCard({ system }: { system: any }){
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">{system.name || 'Sistema'}</h4>
        <button className="btn btn-sm" onClick={() => setOpen(!open)}>{open ? 'Fechar' : 'Abrir'}</button>
      </div>
      {open && (
        <div className="mt-3 text-sm">
          <p>{system.description || system.overview}</p>
          {system.sublevels && <ul className="list-disc ml-5 mt-2">{system.sublevels.map((s:any, i:number)=>(<li key={i}>{s}</li>))}</ul>}
        </div>
      )}
    </div>
  )
}
