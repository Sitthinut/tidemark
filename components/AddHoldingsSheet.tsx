"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

interface Row {
  ticker: string;
  units: string;
  value: string;
}

interface ExtractedHolding {
  ticker: string;
  units: string;
  value: string;
  source?: string;
}

export interface AddedHolding {
  ticker: string;
  units: string;
  value: string;
  source: string;
  addedAt: number;
}

export interface AddHoldingsSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (rows: AddedHolding[]) => void;
}

export function AddHoldingsSheet({ open, onClose, onAdd }: AddHoldingsSheetProps) {
  const [method, setMethod] = useState<"paste" | "image" | "manual">("paste");
  const [pasteText, setPasteText] = useState("");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgProcessing, setImgProcessing] = useState(false);
  const [imgExtracted, setImgExtracted] = useState<ExtractedHolding[] | null>(null);
  const [rows, setRows] = useState<Row[]>([
    { ticker: "", units: "", value: "" },
    { ticker: "", units: "", value: "" },
  ]);
  const [source, setSource] = useState("Manual");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const parsePaste = (): Row[] => {
    const lines = pasteText.split("\n").filter((l) => l.trim());
    return lines
      .map((line) => {
        const m = line.match(
          /([A-Z][A-Z0-9&-]+)\s*[:,]?\s*([\d,]+(?:\.\d+)?)\s*(?:units|shares)?(?:\s*[,@]?\s*([\d,]+(?:\.\d+)?))?/i,
        );
        if (!m) return null;
        return {
          ticker: m[1],
          units: m[2].replace(/,/g, ""),
          value: m[3] ? m[3].replace(/,/g, "") : "",
        };
      })
      .filter((r): r is Row => r !== null);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImgPreview((ev.target?.result as string) ?? null);
      setImgProcessing(true);
      setTimeout(() => {
        setImgProcessing(false);
        setImgExtracted([
          {
            ticker: "K-USA-A",
            units: "8945.31",
            value: "162804.55",
            source: "Kasikorn statement (Apr 2026)",
          },
          {
            ticker: "K-FIXED",
            units: "14820.30",
            value: "178420.27",
            source: "Kasikorn statement (Apr 2026)",
          },
        ]);
      }, 1800);
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    let toAdd: ExtractedHolding[] = [];
    if (method === "paste") toAdd = parsePaste();
    if (method === "image" && imgExtracted) toAdd = imgExtracted;
    if (method === "manual") toAdd = rows.filter((r) => r.ticker && (r.units || r.value));

    const enriched: AddedHolding[] = toAdd.map((t) => ({
      ticker: t.ticker,
      units: t.units,
      value: t.value,
      source: t.source || source,
      addedAt: Date.now(),
    }));
    onAdd(enriched);
    setPasteText("");
    setRows([
      { ticker: "", units: "", value: "" },
      { ticker: "", units: "", value: "" },
    ]);
    setImgPreview(null);
    setImgExtracted(null);
    onClose();
  };

  const updateRow = (i: number, field: keyof Row, val: string) => {
    const copy = [...rows];
    copy[i] = { ...copy[i], [field]: val };
    setRows(copy);
  };

  const addRow = () => setRows([...rows, { ticker: "", units: "", value: "" }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const previewCount =
    method === "paste"
      ? parsePaste().length
      : method === "image"
        ? (imgExtracted?.length ?? 0)
        : rows.filter((r) => r.ticker && (r.units || r.value)).length;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">Add holdings</div>
        <div className="sheet-subtitle">
          Combine holdings from any Thai brokerage. Read-only — we never trade for you.
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--muted)",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "block",
            }}
          >
            SOURCE
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="twk-field"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "var(--card-soft)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          >
            <option>Manual</option>
            <option>SCB Easy Invest</option>
            <option>Kasikorn (K-My Funds)</option>
            <option>Krungsri Asset</option>
            <option>BBLAM</option>
            <option>Other Thai brokerage</option>
          </select>
        </div>

        <div className="method-tabs">
          <button data-active={method === "paste"} onClick={() => setMethod("paste")}>
            📋 Paste
          </button>
          <button data-active={method === "image"} onClick={() => setMethod("image")}>
            📷 Image
          </button>
          <button data-active={method === "manual"} onClick={() => setMethod("manual")}>
            ✎ Type
          </button>
        </div>

        {method === "paste" && (
          <div>
            <textarea
              className="sheet-input"
              placeholder={
                "e.g.\nK-USA-A: 8,945 units\nSCBS&P500: 12,450 units\nK-FIXED, 14820, 178420"
              }
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 6,
                lineHeight: 1.45,
                fontFamily: "var(--font-mono)",
              }}
            >
              ⓘ TICKER + units or value · one per line · we&apos;ll parse it
            </div>
          </div>
        )}

        {method === "image" && !imgPreview && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImage}
            />
            <div className="drop-zone" onClick={() => fileRef.current?.click()}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <div className="dz-title">Drop a brokerage screenshot</div>
              <div className="dz-sub">
                or tap to browse · we&apos;ll extract the holdings with AI
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: "var(--accent-soft)",
                borderRadius: 10,
                fontSize: 11.5,
                color: "var(--accent-ink)",
                lineHeight: 1.5,
              }}
            >
              ⓘ <strong style={{ fontWeight: 500 }}>Privacy:</strong> the image is processed
              on-device. We never upload or store screenshots.
            </div>
          </>
        )}

        {method === "image" && imgPreview && (
          <div>
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--line-soft)",
                marginBottom: 12,
                maxHeight: 180,
                position: "relative",
              }}
            >
              <img
                src={imgPreview}
                alt="preview"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: 180,
                  objectFit: "cover",
                }}
              />
              {imgProcessing && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "grid",
                    placeItems: "center",
                    color: "white",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div className="typing" style={{ marginBottom: 6 }}>
                      <span style={{ background: "white" }}></span>
                      <span style={{ background: "white" }}></span>
                      <span style={{ background: "white" }}></span>
                    </div>
                    <div style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
                      Extracting holdings…
                    </div>
                  </div>
                </div>
              )}
            </div>

            {imgExtracted && (
              <div
                style={{
                  background: "var(--card-soft)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-ink)",
                    letterSpacing: "0.04em",
                    marginBottom: 8,
                  }}
                >
                  ● AI EXTRACTED · {imgExtracted.length} HOLDINGS
                </div>
                {imgExtracted.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr auto",
                      gap: 8,
                      fontSize: 12,
                      padding: "4px 0",
                    }}
                  >
                    <span className="num" style={{ fontWeight: 500 }}>
                      {h.ticker}
                    </span>
                    <span style={{ color: "var(--muted)" }}>{h.units} units</span>
                    <span className="num">
                      ฿{Math.round(Number(h.value)).toLocaleString("en-US")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn ghost sm full"
              onClick={() => {
                setImgPreview(null);
                setImgExtracted(null);
              }}
            >
              Use a different image
            </button>
          </div>
        )}

        {method === "manual" && (
          <div>
            <div
              className="manual-row"
              style={{
                fontSize: 10,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontFamily: "var(--font-mono)",
                paddingBottom: 4,
              }}
            >
              <span style={{ padding: "0 4px" }}>Ticker</span>
              <span style={{ padding: "0 4px" }}>Units</span>
              <span style={{ padding: "0 4px" }}>Value (฿)</span>
              <span></span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="manual-row">
                <input
                  placeholder="K-USA-A"
                  value={r.ticker}
                  onChange={(e) => updateRow(i, "ticker", e.target.value)}
                />
                <input
                  placeholder="8,945"
                  value={r.units}
                  onChange={(e) => updateRow(i, "units", e.target.value)}
                />
                <input
                  placeholder="162,804"
                  value={r.value}
                  onChange={(e) => updateRow(i, "value", e.target.value)}
                />
                <button onClick={() => removeRow(i)} aria-label="Remove">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
            <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={addRow}>
              <Icon name="plus" size={12} /> Add row
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            background: "var(--card-soft)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.45,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <Icon name="sparkle" size={14} />
          <div>
            <strong style={{ fontWeight: 500 }}>Or ask the advisor:</strong> say &quot;Add 50k of
            K-FIXED from my SCB account&quot; in chat. The agent confirms before applying.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            style={{ flex: 2 }}
            onClick={submit}
            disabled={previewCount === 0}
          >
            {previewCount > 0
              ? `Add ${previewCount} holding${previewCount > 1 ? "s" : ""}`
              : "Add holdings"}
            <Icon name="check" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
