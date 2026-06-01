"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bot, BotMessageSquare, Clock3, Mic, MicOff, RefreshCcw, Send, Sparkles, SquarePen, User, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import collegeLogo from "../college-logo.PNG"

const createMessage = (type, content) => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type,
  content,
  timestamp: new Date(),
})

const STORAGE_KEY = "chatbot-conversation-v1"
const DEFAULT_WELCOME = [
  createMessage(
    "bot",
    "Welcome to the Khalpar IIT assistant. Ask about admissions, courses, exams, campus services, or anything else you want to find quickly."
  ),
]

const quickPrompts = [
  { label: "Admissions", icon: "sparkles", prompt: "Tell me about admissions and eligibility." },
  { label: "Exam dates", icon: "clock", prompt: "What are the upcoming exam dates?" },
  { label: "Campus help", icon: "bot", prompt: "How do I find campus services and support?" },
  { label: "Office hours", icon: "pen", prompt: "Share office hours and contact details." },
]

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function MarkdownMessage({ children, onLinkSpeak }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ node, ...props }) => <p className="leading-7 text-sm sm:text-[0.95rem]" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-cyan-300 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-cyan-200"
            onClick={() => onLinkSpeak?.(href)}
            {...props}
          >
            {children}
          </a>
        ),
        ul: ({ node, ...props }) => <ul className="ml-5 list-disc space-y-2 text-sm sm:text-[0.95rem]" {...props} />,
        ol: ({ node, ...props }) => <ol className="ml-5 list-decimal space-y-2 text-sm sm:text-[0.95rem]" {...props} />,
        li: ({ node, ...props }) => <li className="leading-7" {...props} />,
        code: ({ inline, children, ...props }) =>
          inline ? (
            <code className="rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[0.8rem] text-cyan-100" {...props}>
              {children}
            </code>
          ) : (
            <code className="block overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-100" {...props}>
              {children}
            </code>
          ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

function QuickPromptButton({ label, icon, onClick }) {
  const iconMap = {
    sparkles: <Sparkles size={14} />,
    clock: <Clock3 size={14} />,
    bot: <BotMessageSquare size={14} />,
    pen: <SquarePen size={14} />,
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/10 hover:text-white"
    >
      <span className="text-cyan-300 transition group-hover:text-cyan-200">{iconMap[icon]}</span>
      {label}
    </button>
  )
}

export default function Home() {
  const [messages, setMessages] = useState(DEFAULT_WELCOME)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechEnabled, setSpeechEnabled] = useState(false)
  const [lastFailedPrompt, setLastFailedPrompt] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  const conversationSummary = useMemo(() => {
    const userCount = messages.filter((message) => message.type === "user").length
    const botCount = messages.filter((message) => message.type === "bot").length
    return {
      total: messages.length,
      userCount,
      botCount,
    }
  }, [messages])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const storedMessages = window.localStorage.getItem(STORAGE_KEY)
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages)
        if (Array.isArray(parsedMessages) && parsedMessages.length) {
          setMessages(
            parsedMessages.map((message) => ({
              ...message,
              timestamp: new Date(message.timestamp),
            }))
          )
        }
      }
    } catch (error) {
      console.warn("Unable to restore conversation history", error)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch (error) {
      console.warn("Unable to persist conversation history", error)
    }
  }, [hydrated, messages])

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const onOnline = () => setIsLoading(false)
    window.addEventListener("online", onOnline)

    return () => {
      window.removeEventListener("online", onOnline)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const speakMessage = (text) => {
    if (!speechEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event)
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])

  const sendMessage = async (messageText) => {
    const trimmedMessage = messageText.trim()

    if (!trimmedMessage || isLoading) {
      return
    }

    const userMessage = createMessage("user", trimmedMessage)
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setIsTyping(true)
    setLastFailedPrompt("")

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      const botResponse = typeof data.response === "string" ? data.response : "I couldn't generate a response."

      const botMessage = createMessage("bot", botResponse)
      setMessages((prev) => [...prev, botMessage])
      setIsTyping(false)
      speakMessage(botResponse.replace(/\*/g, ""))
    } catch (error) {
      console.error("Error:", error)
      const errorMessage = createMessage("bot", "Sorry, I'm having trouble connecting to the server.")
      setMessages((prev) => [...prev, errorMessage])
      setIsTyping(false)
      setLastFailedPrompt(trimmedMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await sendMessage(input)
  }

  const handleVoiceInput = () => {
    if (typeof window === "undefined") {
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.")
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
      recognitionRef.current = null
      inputRef.current?.focus()
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error)
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
    inputRef.current.focus()
  }

  const retryLastPrompt = () => {
    if (lastFailedPrompt) {
      setInput(lastFailedPrompt)
      inputRef.current?.focus()
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-6%] top-[10%] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[28%] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-6 lg:grid-cols-1">
        <section className="flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-2xl">
          <header className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/30 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-white/10 shadow-lg shadow-cyan-950/20">
                  <Image src={collegeLogo} alt="College logo" width={44} height={44} className="h-11 w-11 object-contain" priority />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.32em] text-cyan-200/70">Student Assistant</p>
                  <h1 className="font-[family:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Khalpar IIT Chatbot
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    A cleaner, faster way to get answers about campus life, courses, deadlines, and support.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Online
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSpeechEnabled((current) => !current)
                    if (speechEnabled) {
                      stopSpeaking()
                    }
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${
                    speechEnabled
                      ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {speechEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  {speechEnabled && isSpeaking ? "Speaking" : "Read replies"}
                </button>
                <button
                  type="button"
                  onClick={retryLastPrompt}
                  disabled={!lastFailedPrompt}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCcw size={14} />
                  Retry last
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Messages: {conversationSummary.total}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">You: {conversationSummary.userCount}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Assistant: {conversationSummary.botCount}</span>
              {lastFailedPrompt ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                  Last request needs a retry
                </span>
              ) : null}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.article
                    key={message.id}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                    className={`mb-4 flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex max-w-[92%] gap-3 sm:max-w-[80%] ${message.type === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg ${
                          message.type === "user"
                            ? "border-sky-300/20 bg-sky-500 text-white shadow-sky-950/20"
                            : "border-white/10 bg-white/10 text-cyan-100 shadow-cyan-950/10"
                        }`}
                      >
                        {message.type === "user" ? <User size={18} /> : <Bot size={18} />}
                      </div>

                      <div
                        className={`rounded-[1.4rem] border px-4 py-3 shadow-lg backdrop-blur-md sm:px-5 sm:py-4 ${
                          message.type === "user"
                            ? "border-sky-300/20 bg-sky-500 text-white shadow-sky-950/20"
                            : "border-white/10 bg-slate-950/50 text-slate-100 shadow-black/20"
                        }`}
                      >
                        <MarkdownMessage onLinkSpeak={(href) => speakMessage(`The link is ${href}`)}>
                          {message.content}
                        </MarkdownMessage>
                        <div className="mt-3 flex items-center gap-2 text-[0.7rem] text-slate-300/80">
                          <Clock3 size={12} />
                          {formatTimestamp(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>

              {isTyping ? (
                <div className="mb-4 flex justify-start">
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
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-white/10 bg-slate-950/25 px-4 py-4 sm:px-6">
              <div className="mb-4 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <QuickPromptButton
                    key={prompt.label}
                    label={prompt.label}
                    icon={prompt.icon}
                    onClick={() => handleQuickReply(prompt.prompt)}
                  />
                ))}
              </div>

              <form onSubmit={handleSubmit} className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <label htmlFor="chat-message" className="sr-only">
                  Chat message
                </label>
                <textarea
                  id="chat-message"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      handleSubmit(event)
                    }
                  }}
                  placeholder="Ask about admissions, exams, campus services, or anything else..."
                  rows={3}
                  className="w-full resize-none rounded-[1.1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-400 focus:border-cyan-400/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Enter to send</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Shift + Enter for newline</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Voice input available</span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleVoiceInput}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                        isListening
                          ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                      {isListening ? "Listening" : "Voice"}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:from-cyan-300 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={16} />
                      Send
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Sidebar removed per request - single-column layout now */}
      </div>
    </main>
  )
}