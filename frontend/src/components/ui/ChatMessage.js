import { useState, useEffect } from 'react';

export default function ChatMessage({ role, content, complete }) {
  const [displayContent, setDisplayContent] = useState(content);

  // Handle cursor animation for streaming responses
  useEffect(() => {
    setDisplayContent(content);
  }, [content]);

  return (
    <div className={`flex mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3/4 p-4 rounded-lg ${
          role === 'user'
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        <div className="relative">
          {displayContent}
          {!complete && role === 'assistant' && (
            <span className="absolute h-4 w-2 ml-1 bg-gray-600 animate-pulse"></span>
          )}
        </div>
      </div>
    </div>
  );
}