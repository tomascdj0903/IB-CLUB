'use client';
import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export type ActionState = { ok?: boolean; error?: string; message?: string; id?: string } | null;

export function Submit({ children, className = 'btn-primary', pending: label }: { children: ReactNode; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? label ?? 'Patientez…' : children}</button>;
}

/** Formulaire relié à une action serveur, avec message d'erreur ou de succès. */
export function ActionForm({
  action, children, className, resetOnSuccess = false, onDone,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode; className?: string; resetOnSuccess?: boolean; onDone?: (s: NonNullable<ActionState>) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) { if (resetOnSuccess) ref.current?.reset(); onDone?.(state); }
  }, [state, resetOnSuccess, onDone]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}

/** Petit bouton d'action (une seule action, sans champs). */
export function ActionButton({
  action, label, className = 'btn-ghost btn-sm', confirm, hidden,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  label: string; className?: string; confirm?: string; hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} className="inline-flex flex-col">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Submit className={className}>{label}</Submit>
      {state?.error && <span className="mt-1 max-w-xs text-xs text-rose-700">{state.error}</span>}
    </form>
  );
}
