"use client";

export interface FeedbackRowProps {
  topic?: string;
  label?: string;
  value?: "up" | "down" | null;
  onChange?: (rating: "up" | "down" | null) => void;
  onSave?: () => void;
  saved?: boolean;
}

export function FeedbackRow({
  label = "WAS THIS HELPFUL?",
  value,
  onChange,
  onSave,
  saved = false,
}: FeedbackRowProps) {
  return (
    <div className="feedback-row">
      <span className="fb-label">{label}</span>
      <button
        data-rating="up"
        data-active={value === "up"}
        onClick={() => onChange && onChange(value === "up" ? null : "up")}
        aria-label="Helpful"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H7V10l4.42-7.32a1 1 0 011.58.42v0a3 3 0 01.42 2.32L13 10z" />
        </svg>
      </button>
      <button
        data-rating="down"
        data-active={value === "down"}
        onClick={() => onChange && onChange(value === "down" ? null : "down")}
        aria-label="Not helpful"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 14V2M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H17v12l-4.42 7.32a1 1 0 01-1.58-.42v0a3 3 0 01-.42-2.32L11 14z" />
        </svg>
      </button>
      {onSave && (
        <button
          data-rating="save"
          data-active={saved}
          onClick={onSave}
          aria-label="Save to Journal"
          title="Save to Journal"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
