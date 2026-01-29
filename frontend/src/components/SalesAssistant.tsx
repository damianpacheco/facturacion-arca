/**
 * Asistente de ventas con IA - Panel de chat controlado externamente.
 */

import { useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Box, Text, Button, Spinner } from '@nimbus-ds/components'
import { ChevronRightIcon, GenerativeStarsIcon } from '@nimbus-ds/icons'
import { sendChatMessage } from '../services/api'
import './SalesAssistant.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface SalesAssistantProps {
  isOpen: boolean
  onClose: () => void
}

const SUGGESTED_QUESTIONS = [
  '¿Cómo vienen mis ventas este mes?',
  '¿Cuál es mi mejor cliente?',
  '¿Qué día vendo más?',
  '¿Cómo me fue vs el mes pasado?',
]

import { useState } from 'react'

export default function SalesAssistant({ isOpen, onClose }: SalesAssistantProps) {
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

  if (!isOpen) return null

  return (
    <div className="sales-assistant-panel">
      {/* Header */}
      <div className="sales-assistant-header">
        <Box display="flex" alignItems="center" gap="2">
          <GenerativeStarsIcon size={20} />
          <Text fontWeight="bold" color="neutral-background">
            Asistente de Ventas
          </Text>
        </Box>
        <button
          className="sales-assistant-close"
          onClick={onClose}
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
  )
}
