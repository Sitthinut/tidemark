"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

export interface BucketFormValues {
  id: string;
  name: string;
  typeLabel: string;
  icon: string;
  color: string;
  brokerage: string;
  notes: string;
}

export interface BucketSheetProps {
  open: boolean;
  /** When set, the sheet opens in edit mode pre-filled from these values. */
  initial?: BucketFormValues | null;
  onClose: () => void;
  onSave: (values: BucketFormValues) => void | Promise<void>;
  /** Only available in edit mode. */
  onDelete?: () => void | Promise<void>;
}

const DEFAULT_VALUES: BucketFormValues = {
  id: "",
  name: "",
  typeLabel: "Free",
  icon: "○",
  color: "var(--accent)",
  brokerage: "Demo Broker",
  notes: "",
};

const TYPE_PRESETS = [
  { label: "Free", note: "Long-term core portfolio" },
  { label: "Tax-saving (SSF)", note: "Locked until conditions met" },
  { label: "Tax-saving (RMF)", note: "Retirement-only" },
  { label: "Experiment", note: "Higher-risk plays" },
];

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "bucket"
  );
}

export function BucketSheet({ open, initial, onClose, onSave, onDelete }: BucketSheetProps) {
  const isEdit = !!initial;
  const [values, setValues] = useState<BucketFormValues>(initial ?? DEFAULT_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync form when opening for a different bucket.
  useEffect(() => {
    if (open) {
      setValues(initial ?? DEFAULT_VALUES);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const update = (patch: Partial<BucketFormValues>) =>
    setValues((v) => ({
      ...v,
      ...patch,
      // Auto-derive id from name in create mode (until the user edits id manually).
      id:
        !isEdit && (patch.name !== undefined || v.id === "") ? slugify(patch.name ?? v.name) : v.id,
    }));

  const submit = async () => {
    if (!values.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!values.id.trim()) {
      setError("ID is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = window.confirm(
      `Delete bucket "${values.name}"? This permanently removes the bucket and all its holdings.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">{isEdit ? "Edit bucket" : "New bucket"}</div>
        <div className="sheet-subtitle">
          {isEdit
            ? "Update bucket details. Changes apply immediately."
            : "A bucket holds a set of fund positions — e.g. Core, SSF, Experiment."}
        </div>

        <div className="sheet-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormRow label="Name">
            <input
              className="sheet-input"
              value={values.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Core"
            />
          </FormRow>

          <FormRow
            label="ID"
            hint={isEdit ? "Cannot be changed" : "URL-safe slug; auto-derived from name"}
          >
            <input
              className="sheet-input"
              value={values.id}
              onChange={(e) => update({ id: slugify(e.target.value) })}
              disabled={isEdit}
              placeholder="core"
            />
          </FormRow>

          <FormRow label="Type">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {TYPE_PRESETS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => update({ typeLabel: t.label })}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "1px solid",
                    borderColor:
                      values.typeLabel === t.label ? "var(--accent)" : "var(--line-soft)",
                    borderRadius: 8,
                    background:
                      values.typeLabel === t.label ? "var(--accent-soft)" : "var(--paper)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {t.note}
                  </div>
                </button>
              ))}
            </div>
          </FormRow>

          <FormRow label="Icon">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["○", "◐", "●", "◇", "△", "□", "✦", "♥"].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => update({ icon })}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid",
                    borderColor: values.icon === icon ? "var(--accent)" : "var(--line-soft)",
                    background: values.icon === icon ? "var(--accent-soft)" : "var(--paper)",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </FormRow>

          <FormRow label="Brokerage">
            <input
              className="sheet-input"
              value={values.brokerage}
              onChange={(e) => update({ brokerage: e.target.value })}
              placeholder="Demo Broker"
            />
          </FormRow>

          <FormRow label="Notes" hint="Optional one-liner; shown on the bucket card.">
            <textarea
              className="sheet-input"
              value={values.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Long-term core portfolio. No restrictions."
              rows={3}
              style={{ resize: "vertical", minHeight: 60 }}
            />
          </FormRow>

          {error && (
            <div
              style={{
                color: "var(--loss)",
                fontSize: 12.5,
                padding: "8px 12px",
                background: "var(--loss-soft, rgba(220,38,38,0.08))",
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="sheet-actions" style={{ display: "flex", gap: 8 }}>
          {isEdit && onDelete && (
            <button
              type="button"
              className="btn ghost"
              onClick={handleDelete}
              disabled={submitting}
              style={{ color: "var(--loss)" }}
            >
              <Icon name="close" size={12} /> Delete
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={submit}
            disabled={submitting}
            style={{ flex: 1 }}
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create bucket"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--muted)",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {label.toUpperCase()}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
