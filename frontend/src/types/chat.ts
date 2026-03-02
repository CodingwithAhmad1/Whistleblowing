export interface ChatMessage {
  id: string
  role: 'ai' | 'user'
  content: string
}
