"use client";

export interface SubjectOption {
  id: string;
  name: string;
}

export function SubjectSelect({
  value,
  onChange,
  subjects,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  subjects: SubjectOption[];
  placeholder: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring ${className}`}
    >
      <option value="">{placeholder}</option>
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
