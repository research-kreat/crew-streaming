import { useState } from 'react';

export default function ChatInput({ onSendMessage, isDisabled, isStreaming, connectionError }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || isDisabled) return;
    
    onSendMessage(message.trim());
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isDisabled}
        placeholder={
          connectionError 
            ? "Connection lost. Please try again later." 
            : isStreaming 
              ? "Waiting for response..." 
              : "Type your message..."
        }
        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
      <button
        type="submit"
        disabled={isDisabled || !message.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {isStreaming ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Thinking...
          </div>
        ) : connectionError ? (
          "Reconnect"
        ) : (
          "Send"
        )}
      </button>
    </form>
  );
}