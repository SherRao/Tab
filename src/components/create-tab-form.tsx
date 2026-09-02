"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { CreateEventPeopleInput } from "@/components/people/create-event-people-input";
import { ErrorNote } from "@/components/ui/error-note";

const SUGGESTIONS = ["Dinner", "Weekend trip", "Apartment", "Bachelorette"];

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
  const [submitting, setSubmitting] = useState(false);

  function continueToPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canContinueToPeople(name)) setStep(2);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    setSubmitting(true);
    window.setTimeout(() => {
      void Promise.resolve(action(new FormData(form)));
    }, 500);
  }

  return (
    <form
      action={action}
      onSubmit={step === 1 ? continueToPeople : handleSubmit}
      className="paper-card receipt-edge rise-in mt-8 p-6 sm:p-8"
      style={{ "--delay": "280ms" } as CSSProperties}
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
        <ErrorNote variant="form" className="mt-4">
          Please provide a name and one other person.
        </ErrorNote>
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
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setName(suggestion)}
                className="chip"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-ink mt-6 w-full">
            Continue →
          </button>
        </div>
      ) : (
        <div className="form-step mt-10">
          <input type="hidden" name="name" value={name} />
          <p className="display text-3xl sm:text-4xl">Who&apos;s in on {name.trim()}?</p>
          <p className="mt-3 text-stone-500">
            {peopleCount > 0
              ? `You + ${peopleCount} other${peopleCount === 1 ? "" : "s"} = ${
                  peopleCount + 1
                } people.`
              : "You're in — add one other person."}
          </p>
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
            {submitting ? (
              <span className="stamp stamp-pop">tab open ✓</span>
            ) : (
              <button type="submit" disabled={peopleCount < 1} className="btn-ink">
                {peopleCount < 1 ? "Add 1 more person" : "Start tab →"}
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}