'use client';

import { useState, useRef, useEffect } from 'react';
import ChatInput from '@/components/ui/ChatInput';
import ChatMessage from '@/components/ui/ChatMessage';
import useWebSocket from '@/hooks/useWebSocket';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState("Business Idea Development");
  const [abstract, setAbstract] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  
  // WebSocket hook - keep the same URL structure
  const { sendMessage, lastMessage, readyState, connected } = useWebSocket(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  );

  // Handle scrolling to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      const data = JSON.parse(lastMessage.data);
      
      // Handle error
      if (data.error) {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `Error: ${data.error}`, complete: true }
        ]);
        setIsStreaming(false);
        return;
      }
      
      // Handle token (streaming)
      if (data.token) {
        setMessages(prev => {
          const prevMessages = [...prev];
          const lastMsg = prevMessages[prevMessages.length - 1];
          
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.complete) {
            prevMessages[prevMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + data.token
            };
          } else {
            prevMessages.push({ role: 'assistant', content: data.token, complete: false });
          }
          
          return prevMessages;
        });
      }
      
      // Handle completion
      if (data.done) {
        setMessages(prev => {
          const prevMessages = [...prev];
          if (prevMessages.length > 0 && !prevMessages[prevMessages.length - 1].complete) {
            prevMessages[prevMessages.length - 1].complete = true;
          }
          return prevMessages;
        });
        setIsStreaming(false);
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  }, [lastMessage]);

  // Handle sending messages
  const handleSendMessage = (message) => {
    // Don't allow sending when already streaming
    if (isStreaming) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: message, complete: true };
    setMessages(prev => [...prev, userMessage]);
    
    // Start streaming indicator
    setIsStreaming(true);
    
    // Format conversation history
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Send to WebSocket
    sendMessage(JSON.stringify({
      user_input: message,
      title_context: title,
      abstract_context: abstract,
      conversation_history: conversationHistory
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow p-4">
        <h1 className="text-2xl font-bold text-gray-800">CrewAI Chat with Mistral</h1>
        <p className="text-sm text-gray-500">Using Ollama + CrewAI for natural conversations</p>
      </header>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <h2 className="text-xl font-semibold">Welcome to CrewAI Chat</h2>
              <p className="mt-2">Start a conversation about your business ideas!</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage 
              key={index} 
              role={message.role} 
              content={message.content} 
              complete={message.complete} 
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Status indicator */}
      {!connected && (
        <div className="bg-yellow-100 p-2 text-center text-yellow-800">
          Connecting to server...
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 bg-white border-t">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isDisabled={isStreaming || !connected} 
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}