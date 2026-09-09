"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroupAction, deleteGroupAction, updateGroupAction } from "@/lib/actions";
import { GroupCreateModal } from "@/components/expense/group-create-modal";
import type { EditorGroup } from "@/components/expense/group-pill-row";

/**
 * Manage an event's groups outside the expense editor: rename, change members,
 * create, or delete. Membership edits are live — they re-scope past receipts
 * that split by the group.
 */
export function GroupManager({
  token,
  eventName,
  participants,
  groups,
}: {
  token: string;
  eventName: string;
  participants: { id: number; name: string }[];
  groups: EditorGroup[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editing = modal?.mode === "edit" ? groups.find((g) => g.id === modal.id) : undefined;
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));

  async function handleSave(name: string, memberIds: number[]) {
    setError(null);
    try {
      if (modal?.mode === "edit") {
        await updateGroupAction(token, modal.id, name, memberIds);
      } else {
        await createGroupAction(token, name, memberIds);
      }
      setModal(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the group");
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await deleteGroupAction(token, id);
      setModal(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the group");
    }
  }

  return (
    <>
      {modal && (
        <GroupCreateModal
          eventName={eventName}
          participants={participants}
          initialName={editing?.name}
          initialMemberIds={editing?.memberIds}
          error={error}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? () => handleDelete(modal.id) : undefined}
          onCancel={() => {
            setError(null);
            setModal(null);
          }}
        />
      )}

      {groups.length > 0 && (
        <ul className="space-y-1.5">
          {groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setModal({ mode: "edit", id: g.id });
                }}
                className="group flex w-full items-baseline justify-between gap-3 border-b border-dashed border-foreground/10 py-1.5 text-left transition hover:border-accent/40"
              >
                <span className="font-mono text-xs font-semibold tracking-wide">{g.name}</span>
                <span className="leader-dots" />
                <span className="shrink-0 font-mono text-[11px] text-stone-400">
                  {g.memberIds.map((id) => nameOf.get(id) ?? "?").join(", ") || "no members"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          setError(null);
          setModal({ mode: "create" });
        }}
        className="mt-3 rounded-full border border-dashed border-stone-400 px-3 py-1.5 font-mono text-xs font-medium tracking-wide text-stone-500 uppercase transition hover:border-accent hover:text-accent-strong"
      >
        + New group
      </button>
    </>
  );
}
