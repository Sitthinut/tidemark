"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { FeedbackRow } from "@/components/FeedbackRow";
import {
  AI_PERSONALITIES,
  MODEL_PORTFOLIOS,
  PORTFOLIO,
  USER_GOALS,
  USER_PLAN,
} from "@/lib/mock/data";

interface PlanProposal {
  section: string;
  rationale: string;
  add: string | null;
  rm: string | null;
}

interface Message {
  role: "user" | "ai";
  text: string;
  ts: number;
  proposal?: PlanProposal;
  applied?: boolean;
  rejected?: boolean;
}

interface MsgFeedback {
  rating?: "up" | "down" | null;
  saved?: boolean;
}

export interface ChatScreenProps {
  persona?: string;
  seedPrompt?: string | null;
  onPromptConsumed?: () => void;
}

function PlanProposalCard({
  proposal,
  applied,
  onApply,
  onReject,
}: {
  proposal: PlanProposal;
  applied?: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  if (applied === true) {
    return (
      <div
        className="plan-proposal"
        style={{ background: "var(--accent-soft)", borderColor: "transparent" }}
      >
        <div className="label">
          <span>✓ APPLIED TO YOUR PLAN · {proposal.section.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--accent-ink)" }}>
          Saved to{" "}
          <strong style={{ fontWeight: 500 }}>{proposal.section}</strong>. View
          in Journal → Plan.
        </div>
      </div>
    );
  }
  if (applied === false) {
    return (
      <div
        className="plan-proposal"
        style={{ background: "var(--card-soft)", borderColor: "var(--line)" }}
      >
        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
          }}
        >
          ○ DISMISSED
        </div>
      </div>
    );
  }
  return (
    <div className="plan-proposal">
      <div className="label">
        <Icon name="sparkle" size={12} />
        <span>PLAN CHANGE · {proposal.section.toUpperCase()}</span>
      </div>
      <div className="diff">
        {proposal.rm && <span className="rm">{proposal.rm}</span>}
        {proposal.rm && proposal.add && "\n"}
        {proposal.add && <span className="add">{proposal.add}</span>}
      </div>
      <div
        style={{ fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.45 }}
      >
        {proposal.rationale}
      </div>
      <div className="actions">
        <button className="btn ghost sm" onClick={onReject}>
          Not now
        </button>
        <button
          className="btn primary sm"
          onClick={onApply}
          style={{ flex: 1 }}
        >
          <Icon name="check" size={12} /> Apply to plan
        </button>
      </div>
    </div>
  );
}

export function ChatScreen({
  persona = "advisor",
  seedPrompt,
  onPromptConsumed,
}: ChatScreenProps) {
  void persona; // single advisor persona for MVP
  void MODEL_PORTFOLIOS;
  void USER_GOALS;
  const portfolio = PORTFOLIO;

  const initial = useMemo<Message[]>(() => {
    const planText = USER_PLAN.markdown?.trim();
    if (!planText) {
      return [
        {
          role: "ai",
          text: `Hi — I'm your index-investing advisor. I can see your portfolio (฿${Math.round(
            portfolio.totalValue / 1000,
          )}k across ${portfolio.holdings.length} funds).\n\nYou haven't drafted your plan yet. We can build it together — just say "help me write my plan" and I'll walk you through it.`,
          ts: Date.now(),
        },
      ];
    }
    return [
      {
        role: "ai",
        text: `Hi — I'm your advisor. I've read your plan and can see your portfolio (฿${Math.round(
          portfolio.totalValue / 1000,
        )}k across ${portfolio.holdings.length} funds). Ask me anything about your holdings, your target, or how index investing works.`,
        ts: Date.now(),
      },
    ];
  }, [portfolio]);

  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<Record<number, MsgFeedback>>({});
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const ask = (prompt: string) => {
    if (!prompt.trim() || loading) return;
    const newUserMsg: Message = { role: "user", text: prompt, ts: Date.now() };
    setMessages((m) => [...m, newUserMsg]);
    setInput("");

    const isPlanEdit =
      /add|update|change|set|replace|remove/i.test(prompt) &&
      /(rule|principle|risk|target|commitment|plan)/i.test(prompt);
    if (isPlanEdit) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        const m = prompt.match(
          /(?:add|update|change|set|replace|remove)\s+(?:a|the)?\s*(?:rule|line|principle|note|item)?\s*[:"']?(.+?)["']?$/i,
        );
        const newLine = m && m[1] ? m[1].trim() : prompt.split("about").pop()?.trim() ?? prompt;
        const sectionGuess = /risk/i.test(prompt)
          ? "Risk"
          : /commit|rule/i.test(prompt)
            ? "Commitments"
            : /target|alloc/i.test(prompt)
              ? "Target"
              : "Principles";
        const proposal: PlanProposal = {
          section: sectionGuess,
          rationale: `Adding to your ${sectionGuess} section to reflect: "${newLine}". This will be saved to your plan and the advisor will reference it in future conversations.`,
          add: `- ${newLine}`,
          rm: null,
        };
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            text: `I'll add this to your **${sectionGuess}** section. Here's the change — confirm to apply.`,
            ts: Date.now(),
            proposal,
          },
        ]);
      }, 700);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text:
            "This is a design preview — the live chat endpoint isn't wired up yet. Once `POST /api/chat` is in place it will stream the advisor's reply here, with your portfolio and plan loaded as context.",
          ts: Date.now(),
        },
      ]);
    }, 900);
  };

  const suggestions = [
    "How am I doing vs my target?",
    "Add a rule: no individual stocks",
    "Update my risk to 25% drawdown",
    "When should I rebalance?",
    "What's a 3-fund portfolio?",
    "Why index over active?",
  ];

  useEffect(() => {
    if (seedPrompt) {
      ask(seedPrompt);
      onPromptConsumed && onPromptConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt]);

  const applyProposal = (idx: number, proposal: PlanProposal) => {
    const sectionHeader = `## ${proposal.section}`;
    const newLine = `\n${proposal.add}`;
    if (USER_PLAN.markdown.includes(sectionHeader)) {
      USER_PLAN.markdown = USER_PLAN.markdown.replace(
        new RegExp(
          `(${sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?)(?=\\n##|$)`,
        ),
        `$1${newLine}\n`,
      );
    } else {
      USER_PLAN.markdown += `\n\n${sectionHeader}\n${proposal.add}\n`;
    }
    USER_PLAN.lastUpdated = "Just now";
    USER_PLAN.versions = [
      {
        date: "Just now",
        change: `Added to ${proposal.section}: ${proposal.add?.replace(/^- /, "") ?? ""}`,
      },
      ...USER_PLAN.versions,
    ];
    setMessages((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, applied: true } : x)),
    );
  };

  return (
    <div
      className="screen"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 96px)",
      }}
    >
      <div className="topbar">
        <div className="brand" style={{ flex: 1 }}>
          <span>{AI_PERSONALITIES.advisor.label}</span>
          <span
            className="brand-chip"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-ink)",
              borderColor: "transparent",
            }}
          >
            ● INDEX TEACHER
          </span>
        </div>
        <div className="avatar">PN</div>
      </div>

      <div
        className="chat-stream"
        ref={streamRef}
        style={{ flex: 1, paddingBottom: 8, minHeight: 200 }}
      >
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "ai" && (
              <div className="meta">
                Advisor ·{" "}
                {new Date(m.ts).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            {m.proposal && (
              <PlanProposalCard
                proposal={m.proposal}
                applied={m.applied}
                onApply={() => applyProposal(i, m.proposal!)}
                onReject={() => {
                  setMessages((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, applied: false, rejected: true } : x,
                    ),
                  );
                }}
              />
            )}
            {m.role === "ai" && i > 0 && !m.proposal && (
              <FeedbackRow
                label="HELPFUL?"
                value={msgFeedback[i]?.rating ?? null}
                saved={msgFeedback[i]?.saved}
                onChange={(rating) =>
                  setMsgFeedback({
                    ...msgFeedback,
                    [i]: { ...msgFeedback[i], rating },
                  })
                }
                onSave={() =>
                  setMsgFeedback({
                    ...msgFeedback,
                    [i]: { ...msgFeedback[i], saved: !msgFeedback[i]?.saved },
                  })
                }
              />
            )}
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="meta">Advisor · thinking</div>
            <div className="typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      <div className="suggested-chips">
        {suggestions.map((s) => (
          <button
            key={s}
            className="chip"
            onClick={() => ask(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your portfolio, target, or rebalancing…"
          disabled={loading}
        />
        <button type="submit" disabled={!input.trim() || loading}>
          <Icon name="send" size={14} />
        </button>
      </form>
    </div>
  );
}
