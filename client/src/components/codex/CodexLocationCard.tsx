import React, { useState } from 'react';

export default function CodexLocationCard({ location }: { location: any }){
  const [edit, setEdit] = useState(false);
  const [local, setLocal] = useState(location);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold">{local.name}</h4>
          <div className="text-sm text-muted-foreground">{local.type}</div>
        </div>
        <button className="btn btn-sm" onClick={() => setEdit(!edit)}>{edit ? 'Salvar' : 'Editar'}</button>
      </div>
      <div className="mt-3">
        {edit ? (<textarea className="w-full p-2 rounded" value={local.description} onChange={(e)=>setLocal({...local, description: e.target.value})} />) : (<p className="text-sm">{local.description}</p>)}
      </div>
    </div>
  )
}
