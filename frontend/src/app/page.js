"use client"

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react"
import {
  Bot, BotMessageSquare, Clock3, Download, Mic, MicOff, Moon, RefreshCcw,
  Send, Sparkles, SquarePen, Sun, ThumbsDown, ThumbsUp, User, Volume2, VolumeX,
} from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import collegeLogo from "../college-logo.PNG"

// ─── Utilities ─────────────────────────────────────────────────────────────

const createMessage = (type, content, extra = {}) => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type,
  content,
  timestamp: new Date(),
  streaming: false,
  ...extra,
})

const STORAGE_KEY  = "chatbot-conversation-v2"
const SESSION_KEY  = "chatbot-session-id"
const THEME_KEY    = "chatbot-theme"
const MAX_VISIBLE  = 100
const LOAD_MORE_N  = 50

const REMARK_PLUGINS = [remarkGfm]

const quickPrompts = [
  { label: "Admissions", icon: "sparkles", prompt: "Tell me about admissions and eligibility." },
  { label: "Exam dates", icon: "clock",    prompt: "What are the upcoming exam dates?" },
  { label: "Campus help", icon: "bot",     prompt: "How do I find campus services and support?" },
  { label: "Office hours", icon: "pen",    prompt: "Share office hours and contact details." },
]

function formatTimestamp(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Strip markdown/URLs for clean TTS output
function cleanForTTS(text) {
  return text
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_`~[\]]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
}

// ─── Markdown components (hoisted — only `a` is dynamic) ───────────────────

const STATIC_MD_COMPONENTS = {
  p:      ({ node, ...props }) => <p className="leading-7 text-sm sm:text-[0.95rem]" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
  ul:     ({ node, ...props }) => <ul className="ml-5 list-disc space-y-2 text-sm sm:text-[0.95rem]" {...props} />,
  ol:     ({ node, ...props }) => <ol className="ml-5 list-decimal space-y-2 text-sm sm:text-[0.95rem]" {...props} />,
  li:     ({ node, ...props }) => <li className="leading-7" {...props} />,
  // react-markdown v9: no `inline` prop — detect block code by className or newline
  code: ({ node, className, children, ...props }) => {
    const isBlock = /language-\w+/.test(className || "") || String(children).includes("\n")
    return isBlock ? (
      <code className="block overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-100" {...props}>{children}</code>
    ) : (
      <code className="rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[0.8rem] text-cyan-100" {...props}>{children}</code>
    )
  },
}

const MarkdownMessage = memo(function MarkdownMessage({ children, onLinkSpeak }) {
  const components = useMemo(() => ({
    ...STATIC_MD_COMPONENTS,
    a: ({ node, href, children: lc, ...props }) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="font-medium text-cyan-300 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-cyan-200"
        onClick={() => onLinkSpeak?.(href)} {...props}>{lc}</a>
    ),
  }), [onLinkSpeak])

  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {children}
    </ReactMarkdown>
  )
})

// ─── Message card (memoised — P6) ─────────────────────────────────────────

const MOTION_VARIANTS = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0,  scale: 1     },
  exit:    { opacity: 0, y: -12              },
}

const MessageCard = memo(function MessageCard({ message, onLinkSpeak, feedback, onFeedback }) {
  const isUser = message.type === "user"

  return (
    <motion.article
      layout
      {...MOTION_VARIANTS}
      transition={{ duration: 0.25 }}
      className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex max-w-[92%] gap-3 sm:max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg ${
          isUser
            ? "border-sky-300/20 bg-sky-500 text-white shadow-sky-950/20"
            : "border-white/10 bg-white/10 text-cyan-100 shadow-cyan-950/10"
        }`}>
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        {/* Bubble */}
        <div className={`rounded-[1.4rem] border px-4 py-3 shadow-lg backdrop-blur-md sm:px-5 sm:py-4 ${
          isUser
            ? "border-sky-300/20 bg-sky-500 text-white shadow-sky-950/20"
            : "border-white/10 bg-slate-950/50 text-slate-100 shadow-black/20"
        }`}>
          <MarkdownMessage onLinkSpeak={onLinkSpeak}>
            {message.content}
          </MarkdownMessage>

          {/* Streaming cursor */}
          {message.streaming && <span className="streaming-cursor" aria-hidden="true" />}

          <div className="mt-2 flex items-center gap-3 text-[0.7rem] text-slate-300/80">
            <Clock3 size={12} />
            <span>{formatTimestamp(message.timestamp)}</span>

            {/* E15: thumbs up/down on bot messages */}
            {!isUser && !message.streaming && (
              <div className="ml-auto flex items-center gap-1" role="group" aria-label="Rate this response">
                <button
                  type="button"
                  onClick={() => onFeedback(message.id, "up")}
                  aria-pressed={feedback === "up"}
                  aria-label="Helpful"
                  className={`rounded p-0.5 transition hover:text-emerald-300 ${feedback === "up" ? "text-emerald-300" : "text-slate-400"}`}
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(message.id, "down")}
                  aria-pressed={feedback === "down"}
                  aria-label="Not helpful"
                  className={`rounded p-0.5 transition hover:text-rose-300 ${feedback === "down" ? "text-rose-300" : "text-slate-400"}`}
                >
                  <ThumbsDown size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  )
})

// ─── Quick prompt button ──────────────────────────────────────────────────

const QUICK_ICON_MAP = {
  sparkles: <Sparkles size={14} />,
  clock:    <Clock3 size={14} />,
  bot:      <BotMessageSquare size={14} />,
  pen:      <SquarePen size={14} />,
}

function QuickPromptButton({ label, icon, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/10 hover:text-white">
      <span className="text-cyan-300 transition group-hover:text-cyan-200">{QUICK_ICON_MAP[icon]}</span>
      {label}
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Home() {
  // Core state
  const [messages, setMessages] = useState(() => [
    createMessage("bot", "Welcome to the RCCIIT assistant. Ask about admissions, courses, exams, campus services, or anything else you want to find quickly."),
  ])
  const [input,           setInput]           = useState("")
  const [isLoading,       setIsLoading]       = useState(false)
  const [isTyping,        setIsTyping]        = useState(false)
  const [isListening,     setIsListening]     = useState(false)
  const [isSpeaking,      setIsSpeaking]      = useState(false)
  const [speechEnabled,   setSpeechEnabled]   = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState("")
  const [hydrated,        setHydrated]        = useState(false)
  const [isOnline,        setIsOnline]        = useState(true)
  const [voiceError,      setVoiceError]      = useState("")
  const [theme,           setTheme]           = useState("dark")           // E17
  const [messageFeedback, setMessageFeedback] = useState({})               // E15
  const [windowOffset,    setWindowOffset]    = useState(0)                // E16 windowing
  const [exportSuccess,   setExportSuccess]   = useState(false)            // E8

  // Refs
  const messagesEndRef    = useRef(null)
  const inputRef          = useRef(null)
  const recognitionRef    = useRef(null)
  const abortControllerRef = useRef(null)
  const sessionIdRef      = useRef(null)

  // ── Session ID (for context memory E2) ─────────────────────────────
  useEffect(() => {
    const stored = typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      sessionIdRef.current = stored
    } else {
      const id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`
      sessionIdRef.current = id
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SESSION_KEY, id)
    }
  }, [])

  // ── Theme persistence (E17) ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem(THEME_KEY) || "dark"
    setTheme(saved)
    document.documentElement.setAttribute("data-theme", saved)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark"
      document.documentElement.setAttribute("data-theme", next)
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  // ── Restore conversation from localStorage ─────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })))
        }
      }
    } catch (err) {
      console.warn("Unable to restore conversation history", err)
    } finally {
      setHydrated(true)
    }
  }, [])

  // ── Persist conversation (debounced, capped at 100 messages) ───────
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)))
      } catch (err) {
        console.warn("Unable to persist conversation history", err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [hydrated, messages])

  // ── Online/offline tracking (B3 fix for isLoading, M15 badge) ─────
  useEffect(() => {
    if (typeof window === "undefined") return
    setIsOnline(navigator.onLine)
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online",  onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online",  onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      recognitionRef.current?.abort()
    }
  }, [])

  // ── Scroll to latest message ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Conversation summary ───────────────────────────────────────────
  const conversationSummary = useMemo(() => {
    return messages.reduce(
      (acc, m) => { m.type === "user" ? acc.userCount++ : acc.botCount++; return acc },
      { total: messages.length, userCount: 0, botCount: 0 }
    )
  }, [messages])

  // ── E16: windowed message view (show last MAX_VISIBLE, load-more) ──
  const visibleMessages = useMemo(() => {
    const start = Math.max(0, messages.length - MAX_VISIBLE - windowOffset)
    return messages.slice(start)
  }, [messages, windowOffset])

  const hasEarlierMessages = messages.length > MAX_VISIBLE + windowOffset

  // ── Speech synthesis ───────────────────────────────────────────────
  const speakMessage = useCallback((text) => {
    if (!speechEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false) // WebKit onend can silently fail on long utterances
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate  = 1; utt.pitch = 1; utt.volume = 1
    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => setIsSpeaking(false)
    utt.onerror = (e) => {
      console.error("TTS error:", e)
      setIsSpeaking(false)
      setVoiceError("Speech playback failed.")    // B13
    }
    window.speechSynthesis.speak(utt)
  }, [speechEnabled])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const onMessageLinkSpeak = useCallback(
    (href) => speakMessage(`The link is ${href}`),
    [speakMessage]
  )

  // ── Send message (with SSE streaming, E3) ─────────────────────────
  const sendMessage = async (messageText) => {
    const trimmed = messageText.trim()
    if (!trimmed || isLoading || !isOnline) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setMessages(prev => [...prev, createMessage("user", trimmed)])
    setInput("")
    setIsLoading(true)
    setIsTyping(true)
    setLastFailedPrompt("")
    setWindowOffset(0) // reset to bottom on new message

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          stream: true,
          session_id: sessionIdRef.current,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let errMsg = `Request failed (${response.status})`
        try { const d = await response.json(); errMsg = d.response || errMsg } catch {}
        throw new Error(errMsg)
      }

      // ── Stream the response word-by-word ────────────────────────
      setIsTyping(false)
      const botId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `bot-${Date.now()}`

      setMessages(prev => [...prev, { id: botId, type: "bot", content: "", timestamp: new Date(), streaming: true }])

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText  = ""
      let buffer    = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break
          try {
            const { chunk } = JSON.parse(data)
            fullText += chunk
            setMessages(prev =>
              prev.map(m => m.id === botId ? { ...m, content: fullText } : m)
            )
          } catch { /* malformed SSE chunk — ignore */ }
        }
      }

      // Finalise: remove streaming flag
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false } : m))
      speakMessage(cleanForTTS(fullText))

    } catch (error) {
      if (error.name === "AbortError") return
      console.error("Chat error:", error.message)
      setIsTyping(false)
      // Remove any half-written streaming message before adding error
      setMessages(prev => [
        ...prev.filter(m => !m.streaming),
        createMessage("bot", "Sorry, I'm having trouble connecting to the server. Please try again."),
      ])
      setLastFailedPrompt(trimmed)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  // ── E10: retry actually auto-submits ──────────────────────────────
  const retryLastPrompt = useCallback(() => {
    if (lastFailedPrompt) sendMessage(lastFailedPrompt)
  }, [lastFailedPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice input ────────────────────────────────────────────────────
  const handleVoiceInput = () => {
    if (typeof window === "undefined") return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setVoiceError("Speech recognition is not supported in your browser.")
      return
    }
    setVoiceError("")

    if (isListening && recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    const recognition = new SR()
    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
      setVoiceError("")              // B7: clear error on success
      recognitionRef.current = null
      inputRef.current?.focus()
    }
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  const handleQuickReply = (reply) => {
    setInput(reply)
    inputRef.current?.focus()
  }

  // ── E15: thumbs up/down ───────────────────────────────────────────
  const handleFeedback = useCallback(async (messageId, rating) => {
    setMessageFeedback(prev => ({ ...prev, [messageId]: rating }))
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          rating,
          session_id: sessionIdRef.current,
        }),
      })
    } catch { /* feedback is optional — never fail the UI */ }
  }, [])

  // ── E8: export conversation ───────────────────────────────────────
  const exportConversation = useCallback(() => {
    if (typeof window === "undefined") return
    const lines = messages.map(m =>
      `[${formatTimestamp(m.timestamp)}] ${m.type === "user" ? "You" : "RCCIIT Bot"}: ${m.content}`
    )
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `rcciit-chat-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 2000)
  }, [messages])

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-8 lg:py-8">
      {/* Decorative blurs — B10 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-6%] top-[10%] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[28%] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-6">
        <section className="flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-2xl">

          {/* ── Header ─────────────────────────────────────────────── */}
          <header className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/30 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Logo + title */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-white/10 shadow-lg shadow-cyan-950/20">
                  <Image src={collegeLogo} alt="RCCIIT College logo" width={44} height={44} className="h-11 w-11 object-contain" priority />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.32em] text-cyan-200/70">RCCIIT Student Assistant</p>
                  <h1 className="font-[family:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    RCCIIT Chatbot
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    A cleaner, faster way to get answers about campus life, courses, deadlines, and support.
                  </p>
                </div>
              </div>

              {/* Controls row */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {/* Online/Offline badge */}
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                  isOnline
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-300" : "bg-amber-300"}`} />
                  {isOnline ? "Online" : "Offline"}
                </span>

                {/* TTS toggle */}
                <button type="button"
                  onClick={() => { setSpeechEnabled(c => !c); if (speechEnabled) stopSpeaking() }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${
                    speechEnabled
                      ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}>
                  {speechEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  {speechEnabled && isSpeaking ? "Speaking" : "Read replies"}
                </button>

                {/* Retry */}
                <button type="button" onClick={retryLastPrompt} disabled={!lastFailedPrompt}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <RefreshCcw size={14} />
                  Retry
                </button>

                {/* Export (E8) */}
                <button type="button" onClick={exportConversation}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${
                    exportSuccess
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}>
                  <Download size={14} />
                  {exportSuccess ? "Saved!" : "Export"}
                </button>

                {/* Theme toggle (E17) */}
                <button type="button" onClick={toggleTheme} aria-label="Toggle light/dark mode"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white">
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === "dark" ? "Light" : "Dark"}
                </button>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Messages: {conversationSummary.total}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">You: {conversationSummary.userCount}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Bot: {conversationSummary.botCount}</span>
              {lastFailedPrompt && (
                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                  Last request failed — click Retry
                </span>
              )}
            </div>
          </header>

          {/* ── Offline banner (E12) ─────────────────────────────────── */}
          {!isOnline && (
            <div role="alert" className="border-b border-amber-400/20 bg-amber-400/10 px-5 py-2 text-center text-sm text-amber-200">
              You&apos;re offline. Messages will be sent once your connection is restored.
            </div>
          )}

          {/* ── Chat body ───────────────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* B3: aria-live region for screen readers */}
            <div
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
              className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"
            >
              {/* E16: Load earlier button */}
              {hasEarlierMessages && (
                <div className="mb-4 flex justify-center">
                  <button type="button"
                    onClick={() => setWindowOffset(o => o + LOAD_MORE_N)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white">
                    Load earlier messages ({messages.length - MAX_VISIBLE - windowOffset} more)
                  </button>
                </div>
              )}

              <AnimatePresence initial={false}>
                {visibleMessages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    onLinkSpeak={onMessageLinkSpeak}
                    feedback={messageFeedback[message.id]}
                    onFeedback={handleFeedback}
                  />
                ))}

                {/* Typing indicator — inside AnimatePresence for exit animation (M16) */}
                {isTyping && (
                  <motion.div
                    key="typing-indicator"
                    {...MOTION_VARIANTS}
                    transition={{ duration: 0.25 }}
                    role="status"
                    aria-label="Assistant is thinking"
                    className="mb-4 flex justify-start"
                  >
                    <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 py-3 text-slate-200 shadow-lg backdrop-blur-md">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-100">
                        <Bot size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Thinking</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:120ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:240ms]" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ─────────────────────────────────────────── */}
            <div className="border-t border-white/10 bg-slate-950/25 px-4 py-4 sm:px-6">
              {/* Quick prompts */}
              <div className="mb-4 flex flex-wrap gap-2">
                {quickPrompts.map(prompt => (
                  <QuickPromptButton
                    key={prompt.label}
                    label={prompt.label}
                    icon={prompt.icon}
                    onClick={() => handleQuickReply(prompt.prompt)}
                  />
                ))}
              </div>

              <form onSubmit={handleSubmit} className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <label htmlFor="chat-message" className="sr-only">Chat message</label>

                <textarea
                  id="chat-message"
                  ref={inputRef}
                  value={input}
                  maxLength={2000}
                  rows={3}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={event => {
                    // B2: guard against IME composition (Chinese/Japanese/Korean)
                    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                      event.preventDefault()
                      handleSubmit(event)
                    }
                  }}
                  placeholder="Ask about admissions, exams, campus services, or anything else..."
                  className="w-full resize-none rounded-[1.1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-400 focus:border-cyan-400/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                />

                {/* B8: character counter */}
                <div className="mt-1 text-right text-xs text-slate-400">
                  <span className={input.length > 1800 ? "text-amber-300" : ""}>{input.length}</span>
                  /2000
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Enter to send</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Shift+Enter for newline</span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Voice button */}
                    <div className="flex flex-col items-end gap-1">
                      <button type="button" onClick={handleVoiceInput}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                          isListening
                            ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        }`}>
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                        {isListening ? "Listening…" : "Voice"}
                      </button>
                      {voiceError && <span className="text-xs text-amber-300">{voiceError}</span>}
                    </div>

                    {/* Send button */}
                    <button type="submit"
                      disabled={isLoading || !input.trim() || !isOnline}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:from-cyan-300 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                      <Send size={16} />
                      Send
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
