'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2, Trash2, X } from 'lucide-react';
import { chatbotFlow } from '@/ai/flows/chatbot-flow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const quickQuestions = [
  'How to report an issue?',
  'Track my complaint',
  'What issues can I report?',
  'How are points earned?',
  'Contact municipality',
];

type Message = {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
};

const STORAGE_KEY = 'parivartan_chat_history';

type ChatbotPageShellProps = {
  compact?: boolean;
  onClose?: () => void;
};

export function ChatbotPageShell({ compact = false, onClose }: ChatbotPageShellProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
        return;
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }

    setMessages([
      {
        role: 'model',
        content: 'Hello! I am Roadie, your Parivartan Assistant. I can help you report problems and track complaints.',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (question?: string) => {
    const text = question || input;
    if (text.trim() === '') return;

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatbotFlow({ history: newMessages });
      const botMessage: Message = {
        role: 'model',
        content: result.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot flow error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'I am having trouble connecting right now. Please try again later.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([
      {
        role: 'model',
        content: 'Hello! I am Roadie, your Parivartan Assistant. How can I help you today?',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const shellClasses = compact
    ? 'flex h-full flex-col overflow-hidden bg-background text-foreground'
    : 'flex min-h-[calc(100vh-14rem)] flex-col bg-background text-foreground md:min-h-[calc(100vh-12rem)]';

  return (
    <div className={shellClasses}>
      {compact && (
        <div className="bg-slate-900 px-4 py-4 text-white shadow-lg dark:bg-slate-950">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-base font-bold">Roadie</h1>
                <p className="text-xs text-white/75">AI Assistant · Always here to help</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearHistory}
                className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                  title="Close chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* Full-page clear button */}
          {!compact && messages.length > 1 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-7 gap-1.5 rounded-full text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Trash2 className="h-3 w-3" />
                Clear chat
              </Button>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'model' && (
                <Avatar className="h-8 w-8 border border-slate-200 shadow-sm dark:border-slate-700">
                  <AvatarFallback className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  'max-w-[84%] rounded-2xl px-4 py-3 shadow-sm',
                  msg.role === 'user'
                    ? 'rounded-br-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100'
                )}
              >
                {msg.role === 'model' ? (
                  <ReactMarkdown
                    className="text-sm leading-relaxed"
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, ...props }) => <p className="mb-2 whitespace-pre-wrap last:mb-0" {...props} />,
                      ul: ({ node, ...props }) => <ul className="my-2 list-disc list-inside space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="my-2 list-decimal list-inside space-y-1" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                <p className={cn('mt-1 text-[10px]', msg.role === 'user' ? 'text-white/70' : 'text-slate-400')}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>

              {msg.role === 'user' && (
                <Avatar className="h-8 w-8 border border-slate-200 shadow-sm dark:border-slate-700">
                  <AvatarFallback className="bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-end gap-2">
              <Avatar className="h-8 w-8 border border-slate-200 shadow-sm dark:border-slate-700">
                <AvatarFallback className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-400">Typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {quickQuestions.map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                onClick={() => handleSend(question)}
                disabled={isLoading}
                className="flex-shrink-0 rounded-full border-slate-200 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {question}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                placeholder="Type your message..."
                disabled={isLoading}
                className="h-12 rounded-full border-slate-200 bg-white pl-4 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}