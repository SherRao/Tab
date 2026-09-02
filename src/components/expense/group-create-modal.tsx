"use client";

import { useState } from "react";

interface GroupCreateModalProps {
  eventName: string;
  participants: { id: number; name: string }[];
  initialName?: string;
  initialMemberIds?: number[];
  onSave: (name: string, memberIds: number[]) => void;
  onCancel: () => void;
}

export function GroupCreateModal({
  eventName,
  participants,
  initialName = "",
  initialMemberIds = [],
  onSave,
  onCancel,
}: GroupCreateModalProps) {
  const [name, setName] = useState(initialName);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set(initialMemberIds));

  function toggleMember(id: number) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!name.trim() || memberIds.size === 0) return;
    onSave(name.trim(), Array.from(memberIds));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm border border-foreground/20 bg-paper p-6 shadow-lg">
        <h3 className="font-mono text-sm font-semibold">
          {initialName ? "Edit group" : "New group"}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-stone-400">
          {eventName}
        </p>

        <div className="mt-4">
          <label className="label-mono block text-stone-500">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Car A, Roommates"
            className="input-ink mt-1.5 w-full"
          />
        </div>

        <div className="mt-4">
          <label className="label-mono block text-stone-500">Members</label>
          <ul className="mt-2 space-y-1">
            {participants.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={memberIds.has(p.id)}
                    onChange={() => toggleMember(p.id)}
                    className="rounded border-accent-strong"
                  />
                  {p.name}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || memberIds.size === 0}
            className="btn-ink flex-1 disabled:cursor-not-allowed"
          >
            {initialName ? "Save changes" : "Create group"}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
