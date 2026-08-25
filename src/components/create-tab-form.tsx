"use client";

import { useState, type FormEvent } from "react";
import { CreateEventPeopleInput } from "@/components/add-people";

export function canContinueToPeople(name: string) {
  return Boolean(name.trim());
}

export function CreateTabForm({
  action,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [peopleCount, setPeopleCount] = useState(0);

  function continueToPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canContinueToPeople(name)) setStep(2);
  }

  return (
    <form
      action={action}
      onSubmit={step === 1 ? continueToPeople : undefined}
      className="paper-card mt-8 p-6 sm:p-8"
    >
      <p className="label-mono text-accent-strong">Step {step} of 2</p>
      <div className="mt-3 flex gap-2" aria-label={`Step ${step} of 2`}>
        {[1, 2].map((number) => (
          <span
            key={number}
            className={`h-1 flex-1 ${number <= step ? "bg-accent" : "bg-foreground/10"}`}
          />
        ))}
      </div>
      {error && (
        <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
          Please provide a name and one other person.
        </p>
      )}

      {step === 1 ? (
        <div className="form-step mt-10">
          <label htmlFor="name" className="display block text-3xl sm:text-4xl">
            What are you splitting?
          </label>
          <p className="mt-3 text-stone-500">A trip, dinner, birthday — anything shared.</p>
          <input
            id="name"
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Vegas trip…"
            className="input-ink mt-6 text-lg"
            autoFocus
          />
          <button type="submit" className="btn-ink mt-6 w-full">
            Continue →
          </button>
        </div>
      ) : (
        <div className="form-step mt-10">
          <input type="hidden" name="name" value={name} />
          <p className="display text-3xl sm:text-4xl">Who&apos;s in on {name.trim()}?</p>
          <p className="mt-3 text-stone-500">You&apos;re in — add one other person.</p>
          <div className="mt-6">
            <CreateEventPeopleInput onChange={setPeopleCount} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="label-mono text-stone-400 transition hover:text-foreground"
            >
              ← Back
            </button>
            <button type="submit" disabled={peopleCount < 1} className="btn-ink">
              {peopleCount < 1 ? "Add 1 more person" : "Start tab →"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
