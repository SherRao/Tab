"use client";

import { useRef } from "react";
import { SearchChooser } from "./search-chooser";

/** Event page: one explicit pick submits straight to the server action. */
export function AddSomeoneControl({
  token,
  addedUserIds,
  addAction,
}: {
  token: string;
  addedUserIds: number[];
  addAction: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const entryRef = useRef<HTMLInputElement>(null);
  const added = new Set(addedUserIds);

  return (
    <form ref={formRef} action={addAction} className="mt-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="entry" ref={entryRef} />
      <SearchChooser
        addedUserIds={added}
        placeholder="+ Add someone — @username, email, or a name"
        inputLabel="Add someone by username, email, or name"
        onSelect={(choice) => {
          entryRef.current!.value = JSON.stringify(choice);
          formRef.current!.requestSubmit();
        }}
      />
    </form>
  );
}
