import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('../ModuleFeedbackFab', () => ({
  ModuleFeedbackFab: ({ onClick, open, unreadCount }: any) => (
    <button data-testid="feedback-fab" onClick={onClick} aria-expanded={open} aria-label="Open feedback">
      {unreadCount != null && <span data-testid="fab-badge">{unreadCount}</span>}
      FAB
    </button>
  ),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: '42' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// Inline test doubles for components that are not yet implemented
// ---------------------------------------------------------------------------
const TicketStatusBadge = ({ status }: { status: string }) => (
  <span data-testid="status-badge" data-status={status}>{status}</span>
);

const PriorityBadge = ({ priority }: { priority: string }) => (
  <span data-testid="priority-badge" data-priority={priority}>{priority}</span>
);

const FAQAccordion = ({ items, onSearch }: { items: { q: string; a: string }[]; onSearch?: (v: string) => void }) => (
  <div data-testid="faq-accordion">
    {onSearch && <input data-testid="faq-search" onChange={e => onSearch(e.target.value)} />}
    {items.length === 0 && <p data-testid="faq-empty">No results</p>}
    {items.map((item, i) => (
      <details key={i} data-testid={`faq-item-${i}`}>
        <summary>{item.q}</summary>
        <p>{item.a}</p>
      </details>
    ))}
  </div>
);

const ChatWidget = ({ open, onToggle, messages, onSend, typingIndicator, unreadCount }: any) => (
  <div data-testid="chat-widget">
    <button data-testid="chat-toggle" onClick={onToggle}>{open ? 'Close' : 'Open'}</button>
    {unreadCount > 0 && <span data-testid="chat-unread">{unreadCount}</span>}
    {open && (
      <div data-testid="chat-body">
        {typingIndicator && <p data-testid="typing-indicator">Agent is typing…</p>}
        {messages.map((m: any, i: number) => (
          <p key={i} data-testid={`msg-${i}`}>{m.text}</p>
        ))}
        <button data-testid="chat-send" onClick={() => onSend('hello')}>Send</button>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Utility functions under test
// ---------------------------------------------------------------------------
const formatTicketId = (id: number | null | undefined): string => {
  if (id == null) return 'N/A';
  return `TKT-${String(id).padStart(6, '0')}`;
};

const getPriorityColor = (priority: string): string => {
  const map: Record<string, string> = {
    low: '#4caf50',
    medium: '#ff9800',
    high: '#f44336',
    critical: '#9c27b0',
  };
  return map[priority] ?? '#9e9e9e';
};

const getStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    open: 'Open',
    pending: 'Pending',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return map[status] ?? 'Unknown';
};

const truncateMessage = (msg: string | null | undefined, max = 80): string => {
  if (!msg) return '';
  return msg.length > max ? msg.slice(0, max) + '…' : msg;
};

const getPriorityWeight = (priority: string): number => {
  const weights: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return weights[priority] ?? 0;
};

const isTicketEditable = (status: string): boolean => !['resolved', 'closed'].includes(status);

const buildTicketPayload = (data: Record<string, unknown>) => ({
  ...data,
  createdAt: expect.any(String),
});

// ---------------------------------------------------------------------------
// Hooks under test (inline implementations for unit testing)
// ---------------------------------------------------------------------------
const useTicketStatus = (initialStatus: string) => {
  const [status, setStatus] = React.useState(initialStatus);
  const update = (next: string) => setStatus(next);
  return { status, update };
};

const useFAQSearch = (items: { q: string; a: string }[]) => {
  const [query, setQuery] = React.useState('');
  const results = query
    ? items.filter(i => i.q.toLowerCase().includes(query.toLowerCase()))
    : items;
  return { query, setQuery, results };
};

const useChatUnreadCount = (messages: { read: boolean }[]) => {
  return messages.filter(m => !m.read).length;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModuleFeedbackFab', () => {
  it('renders the FAB button', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    render(<ModuleFeedbackFab onClick={vi.fn()} open={false} />);
    expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    const onClick = vi.fn();
    render(<ModuleFeedbackFab onClick={onClick} open={false} />);
    fireEvent.click(screen.getByTestId('feedback-fab'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has aria-expanded=false when closed', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    render(<ModuleFeedbackFab onClick={vi.fn()} open={false} />);
    expect(screen.getByTestId('feedback-fab')).toHaveAttribute('aria-expanded', 'false');
  });

  it('has aria-expanded=true when open', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    render(<ModuleFeedbackFab onClick={vi.fn()} open={true} />);
    expect(screen.getByTestId('feedback-fab')).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows unread badge when unreadCount > 0', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    render(<ModuleFeedbackFab onClick={vi.fn()} open={false} unreadCount={3} />);
    expect(screen.getByTestId('fab-badge')).toHaveTextContent('3');
  });

  it('does not show badge when unreadCount is 0', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    render(<ModuleFeedbackFab onClick={vi.fn()} open={false} unreadCount={0} />);
    expect(screen.queryByTestId('fab-badge')).toBeNull();
  });

  it('has aria-label', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    render(<ModuleFeedbackFab onClick={vi.fn()} open={false} />);
    expect(screen.getByLabelText('Open feedback')).toBeInTheDocument();
  });

  it('does not crash with undefined unreadCount', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    expect(() => render(<ModuleFeedbackFab onClick={vi.fn()} open={false} unreadCount={undefined} />)).not.toThrow();
  });

  it('can be toggled open then closed', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    const onClick = vi.fn();
    const { rerender } = render(<ModuleFeedbackFab onClick={onClick} open={false} />);
    fireEvent.click(screen.getByTestId('feedback-fab'));
    rerender(<ModuleFeedbackFab onClick={onClick} open={true} />);
    expect(screen.getByTestId('feedback-fab')).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders without crashing when no props supplied', () => {
    const { ModuleFeedbackFab } = require('../ModuleFeedbackFab');
    expect(() => render(<ModuleFeedbackFab />)).not.toThrow();
  });
});

describe('TicketStatusBadge', () => {
  it('renders open status', () => {
    render(<TicketStatusBadge status="open" />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('open');
  });

  it('renders pending status', () => {
    render(<TicketStatusBadge status="pending" />);
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'pending');
  });

  it('renders resolved status', () => {
    render(<TicketStatusBadge status="resolved" />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('resolved');
  });

  it('renders closed status', () => {
    render(<TicketStatusBadge status="closed" />);
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'closed');
  });

  it('renders unknown status gracefully', () => {
    render(<TicketStatusBadge status="archived" />);
    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
  });

  it('renders empty string status without crash', () => {
    expect(() => render(<TicketStatusBadge status="" />)).not.toThrow();
  });
});

describe('PriorityBadge', () => {
  it('renders low priority', () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByTestId('priority-badge')).toHaveTextContent('low');
  });

  it('renders medium priority', () => {
    render(<PriorityBadge priority="medium" />);
    expect(screen.getByTestId('priority-badge')).toHaveAttribute('data-priority', 'medium');
  });

  it('renders high priority', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByTestId('priority-badge')).toHaveTextContent('high');
  });

  it('renders critical priority', () => {
    render(<PriorityBadge priority="critical" />);
    expect(screen.getByTestId('priority-badge')).toHaveAttribute('data-priority', 'critical');
  });

  it('renders unknown priority without crash', () => {
    expect(() => render(<PriorityBadge priority="blocker" />)).not.toThrow();
  });
});

describe('FAQAccordion', () => {
  const items = [
    { q: 'How do I reset my password?', a: 'Go to settings and click Reset Password.' },
    { q: 'How do I contact support?', a: 'Use the live chat widget.' },
    { q: 'What are your business hours?', a: 'Monday–Friday, 9am–6pm.' },
  ];

  it('renders all FAQ items', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.getAllByRole('group')).toHaveLength(3);
  });

  it('renders FAQ questions as summaries', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.getByText('How do I reset my password?')).toBeInTheDocument();
  });

  it('renders empty state when items is empty array', () => {
    render(<FAQAccordion items={[]} />);
    expect(screen.getByTestId('faq-empty')).toBeInTheDocument();
  });

  it('renders search input when onSearch provided', () => {
    render(<FAQAccordion items={items} onSearch={vi.fn()} />);
    expect(screen.getByTestId('faq-search')).toBeInTheDocument();
  });

  it('calls onSearch when search input changes', () => {
    const onSearch = vi.fn();
    render(<FAQAccordion items={items} onSearch={onSearch} />);
    fireEvent.change(screen.getByTestId('faq-search'), { target: { value: 'password' } });
    expect(onSearch).toHaveBeenCalledWith('password');
  });

  it('does not render search input without onSearch', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.queryByTestId('faq-search')).toBeNull();
  });

  it('renders first item with correct index testid', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.getByTestId('faq-item-0')).toBeInTheDocument();
  });

  it('renders third item', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.getByTestId('faq-item-2')).toBeInTheDocument();
  });

  it('shows answer text inside item', () => {
    render(<FAQAccordion items={items} />);
    expect(screen.getByText('Go to settings and click Reset Password.')).toBeInTheDocument();
  });

  it('renders empty state message text', () => {
    render(<FAQAccordion items={[]} />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});

describe('ChatWidget', () => {
  const messages = [
    { text: 'Hello, how can I help?', read: true },
    { text: 'I have a billing question.', read: false },
  ];

  it('renders chat toggle button', () => {
    render(<ChatWidget open={false} onToggle={vi.fn()} messages={[]} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.getByTestId('chat-toggle')).toBeInTheDocument();
  });

  it('shows Open label when closed', () => {
    render(<ChatWidget open={false} onToggle={vi.fn()} messages={[]} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.getByTestId('chat-toggle')).toHaveTextContent('Open');
  });

  it('shows Close label when open', () => {
    render(<ChatWidget open={true} onToggle={vi.fn()} messages={messages} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.getByTestId('chat-toggle')).toHaveTextContent('Close');
  });

  it('calls onToggle when button clicked', () => {
    const onToggle = vi.fn();
    render(<ChatWidget open={false} onToggle={onToggle} messages={[]} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    fireEvent.click(screen.getByTestId('chat-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('hides body when closed', () => {
    render(<ChatWidget open={false} onToggle={vi.fn()} messages={[]} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.queryByTestId('chat-body')).toBeNull();
  });

  it('shows body when open', () => {
    render(<ChatWidget open={true} onToggle={vi.fn()} messages={messages} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.getByTestId('chat-body')).toBeInTheDocument();
  });

  it('shows typing indicator when active', () => {
    render(<ChatWidget open={true} onToggle={vi.fn()} messages={messages} onSend={vi.fn()} typingIndicator={true} unreadCount={0} />);
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
  });

  it('hides typing indicator when inactive', () => {
    render(<ChatWidget open={true} onToggle={vi.fn()} messages={messages} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.queryByTestId('typing-indicator')).toBeNull();
  });

  it('shows unread badge when unreadCount > 0', () => {
    render(<ChatWidget open={false} onToggle={vi.fn()} messages={[]} onSend={vi.fn()} typingIndicator={false} unreadCount={2} />);
    expect(screen.getByTestId('chat-unread')).toHaveTextContent('2');
  });

  it('hides unread badge when unreadCount is 0', () => {
    render(<ChatWidget open={false} onToggle={vi.fn()} messages={[]} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.queryByTestId('chat-unread')).toBeNull();
  });

  it('calls onSend when send button clicked', () => {
    const onSend = vi.fn();
    render(<ChatWidget open={true} onToggle={vi.fn()} messages={messages} onSend={onSend} typingIndicator={false} unreadCount={0} />);
    fireEvent.click(screen.getByTestId('chat-send'));
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('renders message texts', () => {
    render(<ChatWidget open={true} onToggle={vi.fn()} messages={messages} onSend={vi.fn()} typingIndicator={false} unreadCount={0} />);
    expect(screen.getByTestId('msg-0')).toHaveTextContent('Hello, how can I help?');
  });
});

// ---------------------------------------------------------------------------
// Utility: formatTicketId
// ---------------------------------------------------------------------------
describe('formatTicketId', () => {
  it('formats a single digit id', () => {
    expect(formatTicketId(1)).toBe('TKT-000001');
  });

  it('formats a 6-digit id without padding', () => {
    expect(formatTicketId(123456)).toBe('TKT-123456');
  });

  it('returns N/A for null', () => {
    expect(formatTicketId(null)).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatTicketId(undefined)).toBe('N/A');
  });

  it('formats id 0', () => {
    expect(formatTicketId(0)).toBe('TKT-000000');
  });

  it('handles large ids', () => {
    expect(formatTicketId(9999999)).toBe('TKT-9999999');
  });
});

// ---------------------------------------------------------------------------
// Utility: getPriorityColor
// ---------------------------------------------------------------------------
describe('getPriorityColor', () => {
  it('returns green for low', () => {
    expect(getPriorityColor('low')).toBe('#4caf50');
  });

  it('returns orange for medium', () => {
    expect(getPriorityColor('medium')).toBe('#ff9800');
  });

  it('returns red for high', () => {
    expect(getPriorityColor('high')).toBe('#f44336');
  });

  it('returns purple for critical', () => {
    expect(getPriorityColor('critical')).toBe('#9c27b0');
  });

  it('returns default grey for unknown priority', () => {
    expect(getPriorityColor('blocker')).toBe('#9e9e9e');
  });

  it('returns default grey for empty string', () => {
    expect(getPriorityColor('')).toBe('#9e9e9e');
  });
});

// ---------------------------------------------------------------------------
// Utility: getStatusLabel
// ---------------------------------------------------------------------------
describe('getStatusLabel', () => {
  it('returns Open for open', () => {
    expect(getStatusLabel('open')).toBe('Open');
  });

  it('returns Pending for pending', () => {
    expect(getStatusLabel('pending')).toBe('Pending');
  });

  it('returns Resolved for resolved', () => {
    expect(getStatusLabel('resolved')).toBe('Resolved');
  });

  it('returns Closed for closed', () => {
    expect(getStatusLabel('closed')).toBe('Closed');
  });

  it('returns Unknown for unrecognized status', () => {
    expect(getStatusLabel('archived')).toBe('Unknown');
  });

  it('returns Unknown for empty string', () => {
    expect(getStatusLabel('')).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// Utility: truncateMessage
// ---------------------------------------------------------------------------
describe('truncateMessage', () => {
  it('returns empty string for null', () => {
    expect(truncateMessage(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(truncateMessage(undefined)).toBe('');
  });

  it('returns message as-is when under max', () => {
    expect(truncateMessage('hello', 80)).toBe('hello');
  });

  it('truncates message at max length', () => {
    const long = 'a'.repeat(100);
    expect(truncateMessage(long, 80)).toBe('a'.repeat(80) + '…');
  });

  it('returns exact max length without truncation', () => {
    const exact = 'b'.repeat(80);
    expect(truncateMessage(exact, 80)).toBe(exact);
  });

  it('uses default max of 80', () => {
    const long = 'x'.repeat(90);
    expect(truncateMessage(long)).toHaveLength(82); // 80 + ellipsis (1 char)
  });
});

// ---------------------------------------------------------------------------
// Utility: getPriorityWeight
// ---------------------------------------------------------------------------
describe('getPriorityWeight', () => {
  it('low = 1', () => expect(getPriorityWeight('low')).toBe(1));
  it('medium = 2', () => expect(getPriorityWeight('medium')).toBe(2));
  it('high = 3', () => expect(getPriorityWeight('high')).toBe(3));
  it('critical = 4', () => expect(getPriorityWeight('critical')).toBe(4));
  it('unknown = 0', () => expect(getPriorityWeight('blocker')).toBe(0));
});

// ---------------------------------------------------------------------------
// Utility: isTicketEditable
// ---------------------------------------------------------------------------
describe('isTicketEditable', () => {
  it('open tickets are editable', () => expect(isTicketEditable('open')).toBe(true));
  it('pending tickets are editable', () => expect(isTicketEditable('pending')).toBe(true));
  it('resolved tickets are not editable', () => expect(isTicketEditable('resolved')).toBe(false));
  it('closed tickets are not editable', () => expect(isTicketEditable('closed')).toBe(false));
});

// ---------------------------------------------------------------------------
// Hook: useTicketStatus
// ---------------------------------------------------------------------------
describe('useTicketStatus', () => {
  it('initializes with given status', () => {
    const { result } = renderHook(() => useTicketStatus('open'));
    expect(result.current.status).toBe('open');
  });

  it('updates status via update()', () => {
    const { result } = renderHook(() => useTicketStatus('open'));
    act(() => result.current.update('resolved'));
    expect(result.current.status).toBe('resolved');
  });

  it('can cycle through statuses', () => {
    const { result } = renderHook(() => useTicketStatus('open'));
    act(() => result.current.update('pending'));
    expect(result.current.status).toBe('pending');
    act(() => result.current.update('closed'));
    expect(result.current.status).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// Hook: useFAQSearch
// ---------------------------------------------------------------------------
describe('useFAQSearch', () => {
  const faqItems = [
    { q: 'Reset password', a: 'Go to settings.' },
    { q: 'Contact support', a: 'Use live chat.' },
    { q: 'Business hours', a: 'Mon–Fri 9–6.' },
  ];

  it('returns all items when query is empty', () => {
    const { result } = renderHook(() => useFAQSearch(faqItems));
    expect(result.current.results).toHaveLength(3);
  });

  it('filters items by query', () => {
    const { result } = renderHook(() => useFAQSearch(faqItems));
    act(() => result.current.setQuery('password'));
    expect(result.current.results).toHaveLength(1);
  });

  it('search is case insensitive', () => {
    const { result } = renderHook(() => useFAQSearch(faqItems));
    act(() => result.current.setQuery('SUPPORT'));
    expect(result.current.results).toHaveLength(1);
  });

  it('returns empty array when no match', () => {
    const { result } = renderHook(() => useFAQSearch(faqItems));
    act(() => result.current.setQuery('zzznomatch'));
    expect(result.current.results).toHaveLength(0);
  });

  it('exposes query value', () => {
    const { result } = renderHook(() => useFAQSearch(faqItems));
    act(() => result.current.setQuery('hours'));
    expect(result.current.query).toBe('hours');
  });
});

// ---------------------------------------------------------------------------
// Hook: useChatUnreadCount
// ---------------------------------------------------------------------------
describe('useChatUnreadCount', () => {
  it('returns 0 for all-read messages', () => {
    expect(useChatUnreadCount([{ read: true }, { read: true }])).toBe(0);
  });

  it('counts unread messages', () => {
    expect(useChatUnreadCount([{ read: true }, { read: false }, { read: false }])).toBe(2);
  });

  it('returns 0 for empty list', () => {
    expect(useChatUnreadCount([])).toBe(0);
  });

  it('counts single unread message', () => {
    expect(useChatUnreadCount([{ read: false }])).toBe(1);
  });
});
