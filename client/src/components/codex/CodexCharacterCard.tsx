import React, { useState } from 'react';

type Character = any;

export default function CodexCharacterCard({ character }: { character: Character }) {
  const [edit, setEdit] = useState(false);
  const [local, setLocal] = useState(character);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{local.name}</h3>
          <p className="text-sm text-muted-foreground">{local.position}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setEdit(!edit)}>{edit ? 'Salvar' : 'Editar'}</button>
        </div>
      </div>
      {edit ? (
        <div className="mt-3">
          <input className="w-full p-2 rounded" value={local.name} onChange={(e) => setLocal({...local, name: e.target.value})} />
          <textarea className="w-full p-2 rounded mt-2" value={local.notes || ''} onChange={(e) => setLocal({...local, notes: e.target.value})} />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm">{local.notes}</p>
        </div>
      )}
    </div>
  );
}
