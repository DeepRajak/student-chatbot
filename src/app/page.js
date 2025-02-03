"use client"

import { useState, useEffect, useRef } from "react"
import { Bot, User, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import EmojiPicker from "emoji-picker-react"
import { motion, AnimatePresence } from "framer-motion"

export default function Home() {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      content:
        "👋 Welcome to the Khalpar IIT Chatbot! I'm here to help you with questions about courses, exams, campus facilities, and more. Feel free to ask anything or use the quick reply buttons below.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel() // Cancel any ongoing speech when component mounts
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel() // Cleanup on unmount
      }
    }
  }, [])

  const speakMessage = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event)
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { type: "user", content: input, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setIsTyping(true)

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      })
      const data = await response.json()
      setTimeout(() => {
        const botMessage = { type: "bot", content: data.response, timestamp: new Date() }
        setMessages((prev) => [...prev, botMessage])
        setIsTyping(false)
        // Speak the bot's response
        speakMessage(data.response)
      }, 1000) // Simulate typing delay
    } catch (error) {
      console.error("Error:", error)
      const errorMessage = {
        type: "bot",
        content: "Sorry, I'm having trouble connecting to the server.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleVoiceInput = () => {
    setIsListening(!isListening)
    if (!isListening) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          setInput(transcript)
          setIsListening(false)
        }
        recognition.onerror = (event) => {
          console.error("Speech recognition error", event.error)
          setIsListening(false)
        }
        recognition.start()
      } else {
        alert("Speech recognition is not supported in your browser.")
        setIsListening(false)
      }
    }
  }

  const handleQuickReply = (reply) => {
    setInput(reply)
    inputRef.current.focus()
  }

  const handleEmojiClick = (emojiObject) => {
    setInput((prev) => prev + emojiObject.emoji)
    setShowEmojiPicker(false)
    inputRef.current.focus()
  }

  const quickReplies = [
    { text: "Courses", icon: "📚" },
    { text: "Exam Dates", icon: "📅" },
    { text: "Campus Map", icon: "🗺️" },
    { text: "Office Hours", icon: "🕒" },
  ]

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-b from-blue-600 to-blue-800">
      <div className="z-10 w-full max-w-4xl items-center justify-between font-mono text-sm p-4 md:p-8">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 flex items-center justify-between">
            <div className="flex items-center">
              <Image src="/college-logo.png" alt="College Logo" width={60} height={60} className="mr-4" />
              <h1 className="text-3xl font-bold text-white">Khalpar IIT Chatbot</h1>
            </div>
            {/* Speech control button */}
            <button
              onClick={isSpeaking ? stopSpeaking : null}
              className={`p-2 rounded-full ${isSpeaking ? 'bg-red-500 hover:bg-red-600' : 'bg-transparent'}`}
            >
              {isSpeaking ? <VolumeX size={24} color="white" /> : <Volume2 size={24} color="white" />}
            </button>
          </div>

          {/* Chat Area */}
          <div className="h-[70vh] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex items-end ${message.type === "user" ? "flex-row-reverse" : ""} max-w-[80%]`}>
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          message.type === "user" ? "bg-blue-500 ml-2" : "bg-gray-300 mr-2"
                        }`}
                      >
                        {message.type === "user" ? <User size={18} color="white" /> : <Bot size={18} color="white" />}
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg shadow ${
                          message.type === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p>{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2 shadow">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reply Buttons */}
            <div className="p-2 bg-gray-100 flex flex-wrap justify-center">
              {quickReplies.map((reply) => (
                <button
                  key={reply.text}
                  onClick={() => handleQuickReply(reply.text)}
                  className="m-1 px-4 py-2 bg-blue-100 text-blue-600 rounded-full text-sm hover:bg-blue-200 transition-colors flex items-center"
                >
                  {reply.icon}
                  <span className="ml-2">{reply.text}</span>
                </button>
              ))}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-gray-100 flex items-center">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-20 left-4">
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </div>
              )}
              <input
                type="text"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900"
              />
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2 ${isListening ? "text-red-500" : "text-gray-500"} hover:text-gray-700 transition-colors`}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}