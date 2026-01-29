/**
 * Asistente de ventas con IA - Botón flotante con chat desplegable.
 */

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Box, Text, Button, Spinner } from '@nimbus-ds/components'
import { ChevronRightIcon } from '@nimbus-ds/icons'

// Ícono de Sparkles/AI (estrellitas)
const SparklesIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
    <path d="M19 13l1 2 1-2 2-1-2-1-1-2-1 2-2 1 2 1z" />
  </svg>
)
import { sendChatMessage } from '../services/api'
import './SalesAssistant.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  '¿Cómo vienen mis ventas este mes?',
  '¿Cuál es mi mejor cliente?',
  '¿Qué día vendo más?',
  '¿Cómo me fue vs el mes pasado?',
]

export default function SalesAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const chatMutation = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.response,
        },
      ])
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Error: ${error.message}`,
        },
      ])
    },
  })

  const handleSend = (message: string) => {
    if (!message.trim() || chatMutation.isPending) return

    // Agregar mensaje del usuario
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: message.trim(),
      },
    ])

    setInputValue('')
    chatMutation.mutate(message.trim())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(inputValue)
  }

  const handleSuggestionClick = (question: string) => {
    handleSend(question)
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        className="sales-assistant-fab"
        onClick={() => setIsOpen(!isOpen)}
        title="Asistente de ventas"
      >
        {isOpen ? (
          <span style={{ fontSize: '24px', lineHeight: 1 }}>×</span>
        ) : (
          <SparklesIcon size={24} />
        )}
      </button>

      {/* Panel de chat */}
      {isOpen && (
        <div className="sales-assistant-panel">
          {/* Header */}
          <div className="sales-assistant-header">
            <Box display="flex" alignItems="center" gap="2">
              <SparklesIcon size={20} />
              <Text fontWeight="bold" color="neutral-background">
                Asistente de Ventas
              </Text>
            </Box>
            <button
              className="sales-assistant-close"
              onClick={() => setIsOpen(false)}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>×</span>
            </button>
          </div>

          {/* Messages */}
          <div className="sales-assistant-messages">
            {messages.length === 0 ? (
              <div className="sales-assistant-welcome">
                <Text fontSize="caption" color="neutral-textLow" textAlign="center">
                  ¡Hola! Soy tu asistente de ventas. Preguntame sobre tu facturación y te daré insights útiles.
                </Text>
                <Box display="flex" flexDirection="column" gap="2" marginTop="4">
                  <Text fontSize="caption" fontWeight="medium">
                    Podés preguntarme:
                  </Text>
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      className="sales-assistant-suggestion"
                      onClick={() => handleSuggestionClick(question)}
                    >
                      {question}
                    </button>
                  ))}
                </Box>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`sales-assistant-message ${message.role}`}
                  >
                    <Text fontSize="caption">
                      {message.content}
                    </Text>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="sales-assistant-message assistant">
                    <Box display="flex" alignItems="center" gap="2">
                      <Spinner size="small" />
                      <Text fontSize="caption" color="neutral-textLow">
                        Analizando...
                      </Text>
                    </Box>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="sales-assistant-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Preguntá sobre tus ventas..."
              disabled={chatMutation.isPending}
            />
            <Button
              type="submit"
              appearance="primary"
              disabled={!inputValue.trim() || chatMutation.isPending}
            >
              <ChevronRightIcon size="small" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
