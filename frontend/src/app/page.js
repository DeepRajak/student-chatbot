"use client"

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react"
import { ArrowUp, Bot, Download, Menu, Mic, MicOff, Paperclip, Plus, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import collegeLogo from "../college-logo.PNG"

/* ─────────────────────────────────────────────────────────────────────────
   Constants & utilities
───────────────────────────────────────────────────────────────────────── */
const CONV_KEY    = "rcciit-conversations-v1"
const SESSION_KEY = "chatbot-session-id"
const MAX_VISIBLE = 100
const LOAD_MORE   = 50

const REMARK_PLUGINS = [remarkGfm]

const QUICK_PROMPTS = [
  { label: "Office Hours",      prompt: "Share office hours and contact details." },
  { label: "Admission Process", prompt: "Tell me about admissions and eligibility." },
  { label: "Exam Dates",        prompt: "What are the upcoming exam dates?" },
  { label: "Faculty Directory", prompt: "How do I find the faculty directory?" },
  { label: "Placement Stats",   prompt: "What are the latest placement statistics?" },
  { label: "Campus Services",   prompt: "How do I find campus services and support?" },
]

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const createMessage = (type, content, extra = {}) => ({
  id: uid(), type, content, timestamp: new Date(), streaming: false, ...extra,
})

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function fmtConvDate(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)   return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" })
}

function cleanForTTS(text) {
  return text
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_`~[\]]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
}

/* ─────────────────────────────────────────────────────────────────────────
   Markdown renderer
───────────────────────────────────────────────────────────────────────── */
const MD = {
  p:      ({ node, ...p }) => <p className="leading-relaxed mb-2 last:mb-0" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold" {...p} />,
  ul:     ({ node, ...p }) => <ul className="ml-4 list-disc space-y-1 mb-2" {...p} />,
  ol:     ({ node, ...p }) => <ol className="ml-4 list-decimal space-y-1 mb-2" {...p} />,
  li:     ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
  a:      ({ node, href, children: c, ...p }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-[#002045] underline font-medium hover:text-[#1a365d]" {...p}>{c}</a>
  ),
  code: ({ node, className, children, ...p }) => {
    const block = /language-\w+/.test(className || "") || String(children).includes("\n")
    return block
      ? <code className="block bg-[#f2f4f6] rounded-lg p-3 text-sm overflow-x-auto font-mono my-2" {...p}>{children}</code>
      : <code className="bg-[#f2f4f6] rounded px-1.5 py-0.5 text-sm font-mono" {...p}>{children}</code>
  },
}

/* ─────────────────────────────────────────────────────────────────────────
   Message card (memoised)
───────────────────────────────────────────────────────────────────────── */
const MessageCard = memo(function MessageCard({ message, feedback, onFeedback, onSpeak }) {
  const isUser = message.type === "user"

  return (
    <div className={`flex gap-3 w-full ${isUser ? "justify-end" : "items-start"}`}>
      {/* Bot avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#1a365d] flex items-center justify-center shrink-0 mt-1 shadow-sm">
          <Bot size={15} className="text-[#86a0cd]" />
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isUser ? "items-end max-w-[85%]" : "w-full max-w-[85%]"}`}>
        {/* Bubble */}
        <div className={`text-[15px] leading-relaxed px-4 py-3 ${
          isUser
            ? "bg-[#e0e3e5] text-[#191c1e] rounded-2xl rounded-tr-sm shadow-sm"
            : "bg-white border border-[#c4c6cf] text-[#191c1e] rounded-2xl rounded-tl-sm shadow-sm"
        }`}>
          {/* Empty streaming state → typing dots */}
          {message.streaming && message.content === "" ? (
            <div className="flex items-center gap-1.5 h-5">
              <span className="w-2 h-2 rounded-full bg-[#002045] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#002045] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#002045] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD}>
              {message.content}
            </ReactMarkdown>
          )}
          {message.streaming && message.content !== "" && (
            <span className="streaming-cursor" aria-hidden="true" />
          )}
        </div>

        {/* Timestamp + actions */}
        <div className={`flex items-center gap-2 px-1 text-xs text-[#74777f] ${isUser ? "flex-row-reverse" : ""}`}>
          <span>{fmtTime(message.timestamp)}</span>
          {!isUser && !message.streaming && (
            <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
              <button onClick={() => onSpeak?.(message.content)}
                aria-label="Read aloud" title="Read aloud"
                className="p-0.5 rounded hover:text-[#002045] transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              </button>
              <button onClick={() => onFeedback(message.id, "up")}
                aria-pressed={feedback === "up"} aria-label="Helpful"
                className={`p-0.5 rounded transition-colors ${feedback === "up" ? "text-emerald-600" : "hover:text-[#002045]"}`}>
                <ThumbsUp size={11} />
              </button>
              <button onClick={() => onFeedback(message.id, "down")}
                aria-pressed={feedback === "down"} aria-label="Not helpful"
                className={`p-0.5 rounded transition-colors ${feedback === "down" ? "text-red-600" : "hover:text-[#002045]"}`}>
                <ThumbsDown size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

/* ─────────────────────────────────────────────────────────────────────────
   Sidebar
───────────────────────────────────────────────────────────────────────── */
function Sidebar({ conversations, activeConvId, onNew, onSwitch, onDelete, onClose, isMobile }) {
  return (
    <aside className="flex flex-col w-64 bg-white border-r border-[#c4c6cf] h-full shrink-0">
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#c4c6cf]">
          <span className="font-semibold text-[#191c1e]">Chats</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[#f2f4f6] text-[#43474e]">
            <X size={18} />
          </button>
        </div>
      )}

      {/* New chat button */}
      <div className="p-3 border-b border-[#eceef0]">
        <button onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-[#002045] text-white py-2.5 px-4 rounded-xl font-semibold text-sm hover:bg-[#1a365d] transition-colors shadow-sm">
          <Plus size={18} />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto chat-scroll px-2 py-2 flex flex-col gap-0.5">
        {conversations.length > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#74777f] px-2 py-1 mt-1">
            Recent Chats
          </p>
        )}
        {conversations.map(conv => (
          <button key={conv.id} onClick={() => onSwitch(conv.id)}
            className={`group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start justify-between gap-1 ${
              conv.id === activeConvId
                ? "bg-[#eceef0] text-[#191c1e] font-medium"
                : "text-[#43474e] hover:bg-[#f2f4f6]"
            }`}>
            <div className="min-w-0 flex-1">
              <div className="truncate">{conv.title}</div>
              <div className="text-[10px] text-[#74777f] mt-0.5">{fmtConvDate(conv.timestamp)}</div>
            </div>
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-[#74777f] px-2 py-3 text-center">
            No conversations yet.<br />Start a new chat!
          </p>
        )}
      </div>

      {/* Clear current chat */}
      <div className="p-3 border-t border-[#eceef0]">
        <button
          onClick={() => activeConvId && onDelete(activeConvId)}
          disabled={!activeConvId}
          className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Trash2 size={16} />
          Clear Chat
        </button>
      </div>
    </aside>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────── */
export default function Home() {
  /* ── State ─────────────────────────────────────────────────────────── */
  const [conversations,    setConversations]    = useState([])
  const [activeConvId,     setActiveConvId]     = useState(null)
  const [messages,         setMessages]         = useState([])

  const [input,            setInput]            = useState("")
  const [isLoading,        setIsLoading]        = useState(false)
  const [isTyping,         setIsTyping]         = useState(false)
  const [sidebarOpen,      setSidebarOpen]      = useState(false)
  const [isListening,      setIsListening]      = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState("")
  const [isOnline,         setIsOnline]         = useState(true)
  const [voiceError,       setVoiceError]       = useState("")
  const [messageFeedback,  setMessageFeedback]  = useState({})
  const [windowOffset,     setWindowOffset]     = useState(0)
  const [exportSuccess,    setExportSuccess]    = useState(false)

  /* ── Refs ──────────────────────────────────────────────────────────── */
  const messagesEndRef     = useRef(null)
  const textareaRef        = useRef(null)
  const recognitionRef     = useRef(null)
  const abortControllerRef = useRef(null)
  const sessionIdRef       = useRef(null)
  const activeConvIdRef    = useRef(null)    // always current, no stale closure
  const saveTimerRef       = useRef(null)

  // Keep ref in sync
  useEffect(() => { activeConvIdRef.current = activeConvId }, [activeConvId])

  /* ── Session ID (context memory) ───────────────────────────────────── */
  useEffect(() => {
    const stored = typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      sessionIdRef.current = stored
    } else {
      const id = uid()
      sessionIdRef.current = id
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SESSION_KEY, id)
    }
  }, [])

  /* ── Load conversations from localStorage ──────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONV_KEY)
      if (!raw) return
      const convs = JSON.parse(raw)
      setConversations(convs)
      if (convs.length > 0) {
        const latest = convs[0]
        setActiveConvId(latest.id)
        setMessages(latest.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })))
      }
    } catch { /* ignore corrupt data */ }
  }, [])

  /* ── Auto-save active conversation (debounced 500ms) ───────────────── */
  useEffect(() => {
    if (!activeConvId || messages.length === 0) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setConversations(prev => {
        const updated = prev.map(c =>
          c.id === activeConvId ? { ...c, messages: messages.slice(-MAX_VISIBLE) } : c
        )
        try { localStorage.setItem(CONV_KEY, JSON.stringify(updated)) } catch {}
        return updated
      })
    }, 500)
    return () => clearTimeout(saveTimerRef.current)
  }, [messages, activeConvId])

  /* ── Online / offline ──────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return
    setIsOnline(navigator.onLine)
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])

  /* ── Cleanup ───────────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      window.speechSynthesis?.cancel()
      recognitionRef.current?.abort()
    }
  }, [])

  /* ── Scroll to latest ──────────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  /* ── Textarea auto-resize ──────────────────────────────────────────── */
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px"
  }, [input])

  /* ── Windowed messages (E16) ───────────────────────────────────────── */
  const visibleMessages = useMemo(() => {
    const start = Math.max(0, messages.length - MAX_VISIBLE - windowOffset)
    return messages.slice(start)
  }, [messages, windowOffset])

  const hasEarlier = messages.length > MAX_VISIBLE + windowOffset

  /* ── Conversation management ────────────────────────────────────────── */
  const startNewChat = useCallback(() => {
    setMessages([])
    setActiveConvId(null)
    setLastFailedPrompt("")
    setMessageFeedback({})
    setWindowOffset(0)
    setSidebarOpen(false)
  }, [])

  const switchConversation = useCallback((convId) => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return
    setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })))
    setActiveConvId(convId)
    setMessageFeedback({})
    setWindowOffset(0)
    setSidebarOpen(false)
  }, [conversations])

  const deleteConversation = useCallback((convId) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convId)
      try { localStorage.setItem(CONV_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
    if (convId === activeConvIdRef.current) {
      setMessages([])
      setActiveConvId(null)
    }
  }, [])

  /* ── TTS ────────────────────────────────────────────────────────────── */
  const speakText = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(cleanForTTS(text)))
  }, [])

  /* ── Feedback (E15) ─────────────────────────────────────────────────── */
  const handleFeedback = useCallback(async (messageId, rating) => {
    setMessageFeedback(prev => ({ ...prev, [messageId]: rating }))
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, rating, session_id: sessionIdRef.current }),
      })
    } catch { /* non-critical */ }
  }, [])

  /* ── Export (E8) ────────────────────────────────────────────────────── */
  const exportConversation = useCallback(() => {
    const text = messages
      .map(m => `[${fmtTime(m.timestamp)}] ${m.type === "user" ? "You" : "RCCIIT Bot"}: ${m.content}`)
      .join("\n\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    a.download = `rcciit-chat-${Date.now()}.txt`
    a.click()
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 2000)
  }, [messages])

  /* ── Send message ─────────────────────────────────────────────────── */
  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || "").trim()
    if (!trimmed || isLoading || !isOnline) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const userMsg  = createMessage("user", trimmed)
    let   convId   = activeConvIdRef.current

    // Create new conversation on first message
    if (!convId) {
      convId = uid()
      const newConv = {
        id: convId,
        title: trimmed.slice(0, 60),
        timestamp: new Date().toISOString(),
        messages: [userMsg],
      }
      setActiveConvId(convId)
      setConversations(prev => {
        const updated = [newConv, ...prev]
        try { localStorage.setItem(CONV_KEY, JSON.stringify(updated)) } catch {}
        return updated
      })
    }

    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsLoading(true)
    setIsTyping(true)
    setLastFailedPrompt("")
    setWindowOffset(0)

    try {
      const response = await fetch("/api/chatbot", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: trimmed, stream: true, session_id: sessionIdRef.current }),
        signal:  controller.signal,
      })

      if (!response.ok) {
        let msg = `Request failed (${response.status})`
        try { const d = await response.json(); msg = d.response || msg } catch {}
        throw new Error(msg)
      }

      setIsTyping(false)
      const botId = uid()
      setMessages(prev => [...prev, { id: botId, type: "bot", content: "", timestamp: new Date(), streaming: true }])

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText  = ""
      let buffer    = ""

      // Collect all SSE chunks first (arrives in one burst from the server)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break
          try {
            const { chunk } = JSON.parse(data)
            fullText += chunk
          } catch { /* malformed chunk */ }
        }
      }

      // Typewriter: reveal word by word at 28ms/word (~35 wpm visual speed)
      const words = fullText.split(" ")
      let revealed = ""
      for (let i = 0; i < words.length; i++) {
        if (controller.signal.aborted) break
        revealed += (i > 0 ? " " : "") + words[i]
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: revealed } : m))
        if (i < words.length - 1) {
          await new Promise(r => setTimeout(r, 28))
        }
      }

      setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: fullText, streaming: false } : m))

    } catch (err) {
      if (err.name === "AbortError") return
      console.error("Chat error:", err.message)
      setIsTyping(false)
      setMessages(prev => [
        ...prev.filter(m => !m.streaming),
        createMessage("bot", "Sorry, I'm having trouble connecting to the server. Please try again."),
      ])
      setLastFailedPrompt(trimmed)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, isOnline])

  /* ── Voice input ─────────────────────────────────────────────────── */
  const handleVoiceInput = useCallback(() => {
    if (typeof window === "undefined") return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setVoiceError("Speech recognition is not supported in this browser."); return }
    setVoiceError("")
    if (isListening && recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
      setIsListening(false)
      return
    }
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onresult = e => { setInput(e.results[0][0].transcript); setIsListening(false); recognitionRef.current = null; textareaRef.current?.focus() }
    rec.onerror  = ()  => { setIsListening(false); recognitionRef.current = null }
    rec.onend    = ()  => { setIsListening(false); recognitionRef.current = null }
    recognitionRef.current = rec
    setIsListening(true)
    rec.start()
  }, [isListening])

  /* ── Retry (E10) — auto-submits ────────────────────────────────────── */
  const retryLast = useCallback(() => {
    if (lastFailedPrompt) sendMessage(lastFailedPrompt)
  }, [lastFailedPrompt, sendMessage])

  /* ─────────────────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fb] text-[#191c1e] antialiased">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <div className="hidden md:block h-full">
        <Sidebar
          conversations={conversations}
          activeConvId={activeConvId}
          onNew={startNewChat}
          onSwitch={switchConversation}
          onDelete={deleteConversation}
          onClose={() => setSidebarOpen(false)}
          isMobile={false}
        />
      </div>

      {/* ── Mobile sidebar (slide-over) ──────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: -264 }} animate={{ x: 0 }} exit={{ x: -264 }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 w-64 md:hidden shadow-xl"
            >
              <Sidebar
                conversations={conversations}
                activeConvId={activeConvId}
                onNew={startNewChat}
                onSwitch={switchConversation}
                onDelete={deleteConversation}
                onClose={() => setSidebarOpen(false)}
                isMobile={true}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top app bar */}
        <header className="h-16 flex items-center justify-between px-4 bg-white border-b border-[#c4c6cf] shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button className="md:hidden p-2 rounded-full hover:bg-[#f2f4f6] text-[#43474e] transition-colors"
              onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <Image src={collegeLogo} alt="RCCIIT" width={40} height={40} className="h-10 w-auto object-contain" priority />
            <span className="font-bold text-xl text-[#002045] font-[family:var(--font-display)] tracking-tight">
              RCCIIT Chatbot
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Online badge */}
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
              isOnline
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-400"}`} />
              {isOnline ? "Online" : "Offline"}
            </span>

            {/* Export button */}
            {messages.length > 0 && (
              <button onClick={exportConversation}
                className={`p-2 rounded-full transition-colors ${exportSuccess ? "text-emerald-600 bg-emerald-50" : "text-[#43474e] hover:bg-[#f2f4f6]"}`}
                title={exportSuccess ? "Saved!" : "Export chat"} aria-label="Export conversation">
                <Download size={18} />
              </button>
            )}

            {/* Retry badge */}
            {lastFailedPrompt && (
              <button onClick={retryLast}
                className="hidden sm:flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] transition-colors">
                Retry last
              </button>
            )}
          </div>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-700 shrink-0">
            You&apos;re offline — messages will be sent once your connection is restored.
          </div>
        )}

        {/* Chat canvas */}
        <section
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
          className="flex-1 overflow-y-auto chat-scroll flex flex-col items-center"
        >
          <div className="w-full max-w-3xl flex flex-col gap-5 p-4 lg:p-6 pb-2">

            {/* Welcome screen */}
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                <div className="relative w-16 h-16 bg-[#1a365d] rounded-2xl flex items-center justify-center mb-4 shadow-md rotate-3 hover:rotate-0 transition-transform duration-300 cursor-default">
                  <Bot size={30} className="text-[#86a0cd]" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <h2 className="text-xl font-semibold text-[#191c1e] font-[family:var(--font-display)]">
                  How can I assist you today?
                </h2>
                <p className="text-sm text-[#43474e] mt-1.5">
                  Ask me about courses, faculty, admissions, or campus life.
                </p>
              </div>
            )}

            {/* Load-earlier button (E16) */}
            {hasEarlier && (
              <div className="flex justify-center">
                <button onClick={() => setWindowOffset(o => o + LOAD_MORE)}
                  className="text-xs text-[#74777f] px-4 py-1.5 rounded-full border border-[#c4c6cf] hover:bg-[#f2f4f6] transition-colors">
                  Load earlier messages
                </button>
              </div>
            )}

            {/* Messages */}
            <AnimatePresence initial={false}>
              {visibleMessages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <MessageCard
                    message={msg}
                    feedback={messageFeedback[msg.id]}
                    onFeedback={handleFeedback}
                    onSpeak={speakText}
                  />
                </motion.div>
              ))}

              {/* Typing indicator (inside AnimatePresence for exit animation) */}
              {isTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  role="status"
                  aria-label="Assistant is thinking"
                  className="flex gap-3 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1a365d] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Bot size={15} className="text-[#86a0cd]" />
                  </div>
                  <div className="bg-white border border-[#c4c6cf] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1.5 h-5">
                      <span className="w-2 h-2 rounded-full bg-[#002045] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-[#002045] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-[#002045] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </section>

        {/* ── Input area ─────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[#f7f9fb] px-4 pb-4 pt-2 flex justify-center">
          <div className="w-full max-w-3xl flex flex-col gap-2">

            {/* Quick prompt chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_PROMPTS.map(qp => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  disabled={isLoading || !isOnline}
                  className="whitespace-nowrap px-4 py-2 rounded-full border border-[#c4c6cf] bg-white text-[#43474e] text-sm font-medium hover:bg-[#eceef0] hover:text-[#002045] hover:border-[#002045] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Textarea container */}
            <div className="relative flex items-end gap-2 bg-white border border-[#c4c6cf] rounded-3xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-[#002045] focus-within:border-[#002045] transition-all">
              {/* Attach button */}
              <button
                className="p-2.5 text-[#43474e] hover:text-[#002045] hover:bg-[#f2f4f6] rounded-full transition-colors mb-1 ml-1 shrink-0"
                aria-label="Attach file" title="Attach file">
                <Paperclip size={20} />
              </button>

              {/* Textarea */}
              <div className="flex-1 min-w-0">
                <label htmlFor="chat-input" className="sr-only">Message RCCIIT Chatbot</label>
                <textarea
                  id="chat-input"
                  ref={textareaRef}
                  value={input}
                  maxLength={2000}
                  rows={1}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    // B2: IME composition guard
                    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                  placeholder="Message RCCIIT Chatbot..."
                  style={{ height: "auto", overflow: "hidden", maxHeight: "128px" }}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none text-[15px] leading-relaxed text-[#191c1e] placeholder:text-[#74777f] py-3 outline-none"
                />
                {/* B8: character counter near limit */}
                {input.length > 1800 && (
                  <span className={`text-xs float-right pr-1 pb-1 ${input.length > 1950 ? "text-[#ba1a1a]" : "text-[#74777f]"}`}>
                    {input.length}/2000
                  </span>
                )}
              </div>

              {/* Voice + Send */}
              <div className="flex items-center gap-1.5 mb-1 mr-1 shrink-0">
                <button
                  onClick={handleVoiceInput}
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                  title="Voice input"
                  className={`p-2.5 rounded-full transition-colors ${
                    isListening
                      ? "bg-red-100 text-red-600"
                      : "bg-[#dde3eb] text-[#41474e] hover:bg-[#c1c7cf]"
                  }`}>
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim() || !isOnline}
                  aria-label="Send message"
                  className="p-2.5 bg-[#002045] text-white rounded-full hover:bg-[#1a365d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>

            {/* Voice error */}
            {voiceError && (
              <p className="text-xs text-center text-amber-600">{voiceError}</p>
            )}

            {/* Disclaimer */}
            <p className="text-center text-xs text-[#74777f]">
              RCCIIT Chatbot can make mistakes. Verify important academic deadlines.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
