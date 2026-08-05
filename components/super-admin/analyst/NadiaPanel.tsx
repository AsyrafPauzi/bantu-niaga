"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Send,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  acquireMicStream,
  classifyMicError,
  createMicRecorder,
  isMicCaptureSupported,
  micErrorMessage,
  recorderBlobType,
  stopMicStream,
} from "@/lib/client/mic-capture";
import { playBase64Audio, unlockBrowserAudio } from "@/lib/client/play-audio";
import { cn } from "@/lib/utils/cn";
import type { NadiaSettings } from "@/lib/super-admin/nadia-settings";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  transcript?: string;
  audioBase64?: string | null;
  audioContentType?: string | null;
  showTranscript?: boolean;
};

export function NadiaPanel({
  initialSettings,
}: {
  initialSettings: NadiaSettings;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [settings] = useState(initialSettings);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const releaseMic = useCallback(() => {
    stopMicStream(streamRef.current);
    streamRef.current = null;
    mediaRef.current = null;
    setMicReady(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("nadia-muted");
    if (stored === "1") setMuted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("nadia-muted", muted ? "1" : "0");
  }, [muted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) {
      releaseMic();
    }
  }, [open, releaseMic]);

  const playAudio = useCallback(
    async (
      base64: string,
      contentType: string,
      opts?: { autoplay?: boolean },
    ): Promise<boolean> => {
      const autoplay = opts?.autoplay ?? false;
      if (autoplay && (muted || !settings.voice_auto_play)) {
        return false;
      }
      const result = await playBase64Audio(base64, contentType);
      return result.ok;
    },
    [muted, settings.voice_auto_play],
  );

  const sendMessage = useCallback(
    async (text: string, opts?: { skipLoadingGuard?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || (loading && !opts?.skipLoadingGuard)) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/super-admin/analyst/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "chat_failed");
        }

        const replyText = data.reply ?? data.transcript ?? "No response.";
        let playbackHint: string | undefined;
        if (data.showVoice && !data.voiceGenerated && data.ttsError) {
          playbackHint = "Voice unavailable — text only.";
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: replyText,
          audioBase64: data.audioBase64,
          audioContentType: data.audioContentType,
          showTranscript: data.showText === false,
          transcript: playbackHint,
        };
        setMessages((m) => [...m, assistantMsg]);

        if (data.audioBase64 && data.audioContentType && data.showVoice) {
          const played = await playAudio(data.audioBase64, data.audioContentType, {
            autoplay: true,
          });
          if (!played) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantMsg.id
                  ? {
                      ...msg,
                      transcript: "Tap Play response to hear Nadia.",
                    }
                  : msg,
              ),
            );
          }
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : "chat_failed";
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text:
              detail === "chat_failed"
                ? "Sorry — I could not reach the analyst service. Check ILMU_API_KEY and try again."
                : `Sorry — ${detail}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, playAudio],
  );

  const attachMicFromGesture = useCallback((): Promise<boolean> => {
    if (streamRef.current?.active) {
      setMicReady(true);
      setMicError(null);
      return Promise.resolve(true);
    }
    if (!isMicCaptureSupported()) {
      return Promise.resolve(false);
    }
    // Invoke getUserMedia in the same synchronous turn as the click/pointer event.
    const pending = acquireMicStream();
    return pending
      .then((stream) => {
        streamRef.current = stream;
        setMicReady(true);
        setMicError(null);
        return true;
      })
      .catch((err) => {
        releaseMic();
        const code = classifyMicError(err);
        setMicError(micErrorMessage(code));
        return false;
      });
  }, [releaseMic]);

  const openPanel = () => {
    unlockBrowserAudio();
    if (isMicCaptureSupported()) {
      void attachMicFromGesture();
    }
    setOpen(true);
  };

  const startRecording = () => {
    if (recording) return;

    const begin = (stream: MediaStream) => {
      try {
        const recorder = createMicRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          const blobType = recorderBlobType(recorder);
          const blob = new Blob(chunksRef.current, { type: blobType });
          const ext = blobType.includes("mp4") ? "m4a" : "webm";
          const form = new FormData();
          form.append("audio", blob, `recording.${ext}`);
          setLoading(true);
          try {
            const res = await fetch("/api/super-admin/analyst/transcribe", {
              method: "POST",
              body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setLoading(false);
            await sendMessage(data.transcript, { skipLoadingGuard: true });
          } catch {
            setMessages((m) => [
              ...m,
              {
                id: `e-${Date.now()}`,
                role: "assistant",
                text: "Could not transcribe audio. Try typing your question.",
              },
            ]);
            setLoading(false);
          }
        };
        mediaRef.current = recorder;
        recorder.start(250);
        setRecording(true);
      } catch (err) {
        const code = classifyMicError(err);
        setMicError(micErrorMessage(code));
      }
    };

    if (streamRef.current?.active) {
      begin(streamRef.current);
      return;
    }

    if (!isMicCaptureSupported()) return;

    void attachMicFromGesture().then((ok) => {
      if (ok && streamRef.current) begin(streamRef.current);
    });
  };

  const stopRecording = () => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
    setRecording(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void openPanel()}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-ink-muted"
      >
        <Mic className="h-4 w-4" />
        Ask Nadia
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[min(520px,80vh)] w-[min(400px,92vw)] flex-col overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-cream-300 bg-cream-50 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-ink">Nadia</p>
          <p className="text-[11px] text-ink-muted">
            Platform revenue analyst
            {micReady ? " · mic ready" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-200"
            aria-label={muted ? "Mute auto-play" : "Unmute auto-play"}
            title={muted ? "Auto-play off — tap Play response to hear replies" : "Auto-play on"}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <Link
            href="/super-admin/ai-agents/nadia"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-200"
            aria-label="Configure Nadia"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-ink-muted px-4 pt-8">
            Ask about MRR, collections, top tenants, or pending invoices.
            Voice or text — read-only answers from live platform data.
          </p>
        ) : null}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onPlay={playAudio} />
        ))}
        {loading ? (
          <p className="text-xs text-ink-muted animate-pulse">
            Nadia is thinking…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-cream-300 p-3">
        {micError ? (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <p>{micError}</p>
            <button
              type="button"
              onClick={() => void attachMicFromGesture()}
              className="shrink-0 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : null}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            unlockBrowserAudio();
            void sendMessage(input);
          }}
        >
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              if (recording) stopRecording();
              else startRecording();
            }}
            disabled={loading}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
              recording
                ? "border-status-danger bg-status-danger/10 text-status-danger"
                : "border-cream-300 bg-white text-ink hover:bg-cream-100",
            )}
            aria-label={recording ? "Stop recording" : "Record voice"}
            title={
              recording
                ? "Stop recording"
                : micReady
                  ? "Record voice question"
                  : "Allow microphone when prompted"
            }
          >
            {recording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue…"
            className="min-w-0 flex-1 rounded-lg border border-cream-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-white disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}

function MessageBubble({
  msg,
  onPlay,
}: {
  msg: ChatMessage;
  onPlay: (base64: string, contentType: string) => Promise<boolean>;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const isUser = msg.role === "user";

  if (msg.showTranscript && !showTranscript) {
    return (
      <div className="flex flex-col items-start gap-2">
        {msg.audioBase64 && msg.audioContentType ? (
          <button
            type="button"
            onClick={() => void onPlay(msg.audioBase64!, msg.audioContentType!)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-100 px-3 py-2 text-xs font-semibold text-brand-800"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Play response
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowTranscript(true)}
          className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink"
        >
          <ChevronDown className="h-3 w-3" />
          Show transcript
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-ink text-white"
            : "border border-cream-300 bg-cream-50 text-ink",
        )}
      >
        <p className="whitespace-pre-wrap">{msg.text}</p>
        {!isUser && msg.transcript && !msg.showTranscript ? (
          <p className="mt-1 text-[10px] text-amber-700">{msg.transcript}</p>
        ) : null}
        {!isUser && msg.audioBase64 && msg.audioContentType ? (
          <button
            type="button"
            onClick={() => void onPlay(msg.audioBase64!, msg.audioContentType!)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
          >
            <Volume2 className="h-3 w-3" />
            Listen again
          </button>
        ) : null}
        {msg.showTranscript && showTranscript ? (
          <button
            type="button"
            onClick={() => setShowTranscript(false)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-muted"
          >
            <ChevronUp className="h-3 w-3" />
            Hide transcript
          </button>
        ) : null}
      </div>
    </div>
  );
}
