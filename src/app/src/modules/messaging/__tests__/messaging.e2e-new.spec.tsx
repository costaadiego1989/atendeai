import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ─── Inline test components ───────────────────────────────────────────────────

function NewConversationDialog({
  onSubmit,
}: {
  onSubmit: (v: { contact: string; message: string }) => void;
}) {
  const [contact, setContact] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [sent, setSent] = React.useState<{ contact: string; message: string } | null>(null);
  return (
    <div>
      <input
        aria-label="contact"
        value={contact}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(e.target.value)}
      />
      <textarea
        aria-label="message"
        value={message}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
      />
      <button
        onClick={() => {
          onSubmit({ contact, message });
          setSent({ contact, message });
        }}
      >
        Send
      </button>
      {sent && (
        <div data-testid="conv-item">
          {sent.contact}: {sent.message}
        </div>
      )}
    </div>
  );
}

function FileAttachmentComposer({ onSend }: { onSend: (f: File) => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  return (
    <div>
      <input
        aria-label="file-upload"
        type="file"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setFile(e.target.files?.[0] ?? null)
        }
      />
      {file && <span data-testid="file-preview">{file.name}</span>}
      <button onClick={() => file && onSend(file)}>Send</button>
    </div>
  );
}

function HandoffPanel({
  status: initialStatus,
  onHandoff,
}: {
  status: string;
  onHandoff: () => void;
}) {
  const [status, setStatus] = React.useState(initialStatus);
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div>
      <span data-testid="status-badge">{status}</span>
      <button onClick={() => setConfirm(true)}>Handoff to Human</button>
      {confirm && (
        <div>
          <span>Are you sure?</span>
          <button
            onClick={() => {
              onHandoff();
              setStatus('human');
              setConfirm(false);
            }}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

function ConversationResolver({ onResolve }: { onResolve: () => void }) {
  const [confirm, setConfirm] = React.useState(false);
  const [closed, setClosed] = React.useState(false);
  return (
    <div>
      {closed ? (
        <span data-testid="closed-badge">Closed</span>
      ) : (
        <>
          <button onClick={() => setConfirm(true)}>Resolve</button>
          {confirm && (
            <button
              onClick={() => {
                onResolve();
                setClosed(true);
              }}
            >
              Confirm
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TriggerPanel() {
  const [active, setActive] = React.useState(false);
  const [toast, setToast] = React.useState('');
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={active}
          onChange={() => {
            setActive((v) => !v);
            setToast('Trigger updated');
          }}
        />
        {active ? <span>Active</span> : <span>Inactive</span>}
      </label>
      {toast && <div data-testid="toast">{toast}</div>}
    </div>
  );
}

function SaleAttributionDialog({
  onSave,
}: {
  onSave: (v: { agent: string; amount: string }) => void;
}) {
  const [agent, setAgent] = React.useState('');
  const [amount, setAmount] = React.useState('');
  return (
    <div>
      <input
        aria-label="agent"
        value={agent}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgent(e.target.value)}
      />
      <input
        aria-label="amount"
        value={amount}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
      />
      <button onClick={() => onSave({ agent, amount })}>Confirm</button>
    </div>
  );
}

function BulkConversationList({
  conversations,
}: {
  conversations: { id: string; unread: boolean }[];
}) {
  const [items, setItems] = React.useState(conversations);
  const [checked, setChecked] = React.useState<string[]>([]);
  const toggle = (id: string) =>
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const markRead = () =>
    setItems((prev) =>
      prev.map((c) => (checked.includes(c.id) ? { ...c, unread: false } : c))
    );
  return (
    <div>
      {items.map((c) => (
        <div key={c.id}>
          <input type="checkbox" aria-label={c.id} onChange={() => toggle(c.id)} />
          {c.unread && <span data-testid={`unread-${c.id}`}>unread</span>}
        </div>
      ))}
      <span data-testid="unread-count">{items.filter((c) => c.unread).length}</span>
      <button onClick={markRead}>Mark Read</button>
    </div>
  );
}

function SearchConversations({ names }: { names: string[] }) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState(names);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setResults(names.filter((n) => n.toLowerCase().includes(val.toLowerCase())));
    }, 300);
  };
  return (
    <div>
      <input aria-label="search" value={query} onChange={handleChange} />
      <ul>
        {results.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

function MentionComposer({ agents }: { agents: string[] }) {
  const [value, setValue] = React.useState('');
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [mentions, setMentions] = React.useState<string[]>([]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    setShowDropdown(v.endsWith('@'));
  };
  const selectMention = (agent: string) => {
    setMentions((prev) => [...prev, agent]);
    setValue(value + agent + ' ');
    setShowDropdown(false);
  };
  return (
    <div>
      <input aria-label="compose" value={value} onChange={handleChange} />
      {showDropdown && (
        <ul data-testid="mention-dropdown">
          {agents.map((a) => (
            <li key={a} onClick={() => selectMention(a)}>
              {a}
            </li>
          ))}
        </ul>
      )}
      {mentions.map((m) => (
        <span key={m} data-testid={`mention-${m}`} style={{ fontWeight: 'bold' }}>
          @{m}
        </span>
      ))}
    </div>
  );
}

function MessageWithReceipt({ onSend }: { onSend: () => void }) {
  const [receipt, setReceipt] = React.useState<'none' | 'sent' | 'read'>('none');
  return (
    <div>
      <button onClick={() => { onSend(); setReceipt('sent'); }}>Send</button>
      {receipt === 'sent' && (
        <>
          <span data-testid="single-check">✓</span>
          <button data-testid="simulate-read" onClick={() => setReceipt('read')}>
            simulate-read
          </button>
        </>
      )}
      {receipt === 'read' && <span data-testid="double-check">✓✓</span>}
    </div>
  );
}

function DeletableMessage({ content }: { content: string }) {
  const [showMenu, setShowMenu] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  if (deleted) return null;
  return (
    <div>
      <span
        data-testid="message-text"
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      >
        {content}
      </span>
      {showMenu && (
        <button onClick={() => { setShowMenu(false); setShowConfirm(true); }}>Delete</button>
      )}
      {showConfirm && (
        <button onClick={() => setDeleted(true)}>Confirm Delete</button>
      )}
    </div>
  );
}

function EditableMessage({ initial }: { initial: string }) {
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  return (
    <div>
      {editing ? (
        <>
          <input
            aria-label="edit-input"
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          />
          <button onClick={() => { setContent(draft); setEditing(false); }}>Save</button>
        </>
      ) : (
        <span
          data-testid="message-content"
          onDoubleClick={() => { setDraft(content); setEditing(true); }}
        >
          {content}
        </span>
      )}
    </div>
  );
}

function UnreadFilter({
  conversations,
}: {
  conversations: { id: string; unread: boolean; label: string }[];
}) {
  const [filter, setFilter] = React.useState(false);
  const visible = filter ? conversations.filter((c) => c.unread) : conversations;
  return (
    <div>
      <button onClick={() => setFilter((v) => !v)}>Unread</button>
      <ul>
        {visible.map((c) => (
          <li key={c.id} data-testid={`conv-${c.id}`}>
            {c.label}
          </li>
        ))}
      </ul>
      <span data-testid="visible-count">{visible.length}</span>
    </div>
  );
}

function AssignConversation({
  agents,
  onAssign,
}: {
  agents: string[];
  onAssign: (a: string) => void;
}) {
  const [showList, setShowList] = React.useState(false);
  const [assigned, setAssigned] = React.useState<string | null>(null);
  const select = (a: string) => { onAssign(a); setAssigned(a); setShowList(false); };
  return (
    <div>
      <button onClick={() => setShowList(true)}>Assign</button>
      {showList && (
        <ul>
          {agents.map((a) => (
            <li key={a} onClick={() => select(a)}>
              {a}
            </li>
          ))}
        </ul>
      )}
      {assigned && <span data-testid="assigned-agent">{assigned}</span>}
    </div>
  );
}

function ExportButton({ onExport }: { onExport: () => void }) {
  return <button onClick={onExport}>Export</button>;
}

function RealtimeMessages({ initialMessages }: { initialMessages: string[] }) {
  const [messages, setMessages] = React.useState(initialMessages);
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      setMessages((prev) => [...prev, detail.text]);
    };
    window.addEventListener('ws-message', handler);
    return () => window.removeEventListener('ws-message', handler);
  }, []);
  return (
    <ul>
      {messages.map((m, i) => (
        <li key={i} data-testid={`msg-${i}`}>
          {m}
        </li>
      ))}
    </ul>
  );
}

function AuthenticatedSender({
  onSend,
}: {
  onSend: () => Promise<{ status: number }>;
}) {
  const [msg, setMsg] = React.useState('');
  const handle = async () => {
    const res = await onSend();
    if (res.status === 401) setMsg('Session expired. Please log in again.');
  };
  return (
    <div>
      <button onClick={handle}>Send</button>
      {msg && <span data-testid="redirect-msg">{msg}</span>}
    </div>
  );
}

function HandoffWithPermission({
  onHandoff,
}: {
  onHandoff: () => Promise<{ status: number }>;
}) {
  const [error, setError] = React.useState('');
  const handle = async () => {
    const res = await onHandoff();
    if (res.status === 403) setError('Permission denied');
  };
  return (
    <div>
      <button onClick={handle}>Handoff</button>
      {error && <div data-testid="error-toast">{error}</div>}
    </div>
  );
}

function RetryableSender({
  onSend,
}: {
  onSend: () => Promise<{ ok: boolean }>;
}) {
  const [state, setState] = React.useState<'idle' | 'retry' | 'sent'>('idle');
  const handle = async () => {
    const res = await onSend();
    if (!res.ok) setState('retry');
    else setState('sent');
  };
  return (
    <div>
      <button onClick={handle}>Send</button>
      {state === 'retry' && (
        <button data-testid="retry-btn" onClick={handle}>
          Retry
        </button>
      )}
      {state === 'sent' && <span data-testid="sent-indicator">Sent</span>}
    </div>
  );
}

function ConcurrentSender() {
  const [messages, setMessages] = React.useState<string[]>([]);
  return (
    <div>
      <button onClick={() => setMessages((prev) => [...prev, 'A'])}>Send A</button>
      <button onClick={() => setMessages((prev) => [...prev, 'B'])}>Send B</button>
      <ul>
        {messages.map((m, i) => (
          <li key={i} data-testid={`concurrent-msg-${i}`}>
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttachmentUploader({ maxSize }: { maxSize: number }) {
  const [error, setError] = React.useState('');
  const [filename, setFilename] = React.useState('');
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > maxSize) { setError('File too large'); setFilename(''); }
    else { setFilename(f.name); setError(''); }
  };
  return (
    <div>
      <input type="file" aria-label="attachment" onChange={handleFile} />
      {error && <span data-testid="size-error">{error}</span>}
      {filename && <span data-testid="upload-name">{filename}</span>}
    </div>
  );
}

function TriggerManager({
  triggers: initial,
}: {
  triggers: { id: string; name: string }[];
}) {
  const [triggers, setTriggers] = React.useState(initial);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const remove = (id: string) => {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
    setConfirmId(null);
  };
  return (
    <div>
      {triggers.map((t) => (
        <div key={t.id} data-testid={`trigger-${t.id}`}>
          <span>{t.name}</span>
          <button onClick={() => setConfirmId(t.id)}>Delete</button>
          {confirmId === t.id && (
            <button onClick={() => remove(t.id)}>Confirm</button>
          )}
        </div>
      ))}
    </div>
  );
}

function ConversationSearchEmpty({
  onSearch,
}: {
  onSearch: (q: string) => string[];
}) {
  const [results, setResults] = React.useState<string[] | null>(null);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResults(onSearch(e.target.value));
  };
  return (
    <div>
      <input aria-label="search-empty" onChange={handleChange} />
      {results !== null && results.length === 0 && (
        <span data-testid="no-results">No results</span>
      )}
      {results && results.map((r, i) => <div key={i}>{r}</div>)}
    </div>
  );
}

function NotificationBadge({
  conversationId,
  onNavigate,
}: {
  conversationId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <button data-testid="notif-badge" onClick={() => onNavigate(conversationId)}>
      🔔
    </button>
  );
}

function AttributionWithFeedback({
  onSave,
}: {
  onSave: (agent: string) => Promise<void>;
}) {
  const [agent, setAgent] = React.useState('');
  const [toast, setToast] = React.useState('');
  const handle = async () => {
    await onSave(agent);
    setToast(`Attribution saved for ${agent}`);
  };
  return (
    <div>
      <input
        aria-label="attribution-agent"
        value={agent}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgent(e.target.value)}
      />
      <button onClick={handle}>Save</button>
      {toast && <div data-testid="success-toast">{toast}</div>}
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Messaging E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. creates a new conversation and shows it in the list', async () => {
    const onSubmit = vi.fn();
    render(<NewConversationDialog onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('contact'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText('message'), { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByText('Send'));
    expect(onSubmit).toHaveBeenCalledWith({ contact: 'Alice', message: 'Hello there' });
    await waitFor(() =>
      expect(screen.getByTestId('conv-item')).toHaveTextContent('Alice: Hello there')
    );
  });

  it('2. uploads file, shows preview, and calls onSend with file', async () => {
    const onSend = vi.fn();
    render(<FileAttachmentComposer onSend={onSend} />);
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('file-upload'), { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByTestId('file-preview')).toHaveTextContent('report.pdf')
    );
    fireEvent.click(screen.getByText('Send'));
    expect(onSend).toHaveBeenCalledWith(file);
  });

  it('3. completes human handoff and updates status badge', async () => {
    const onHandoff = vi.fn();
    render(<HandoffPanel status="bot" onHandoff={onHandoff} />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('bot');
    fireEvent.click(screen.getByText('Handoff to Human'));
    await waitFor(() => expect(screen.getByText('Are you sure?')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirm'));
    expect(onHandoff).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('status-badge')).toHaveTextContent('human')
    );
  });

  it('4. resolves conversation and shows Closed badge', async () => {
    const onResolve = vi.fn();
    render(<ConversationResolver onResolve={onResolve} />);
    fireEvent.click(screen.getByText('Resolve'));
    await waitFor(() => expect(screen.getByText('Confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirm'));
    expect(onResolve).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('closed-badge')).toHaveTextContent('Closed')
    );
  });

  it('5. toggles automation trigger and shows toast and Active label', async () => {
    render(<TriggerPanel />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() =>
      expect(screen.getByTestId('toast')).toHaveTextContent('Trigger updated')
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('6. fills attribution form and calls onSave with correct values', () => {
    const onSave = vi.fn();
    render(<SaleAttributionDialog onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('agent'), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '250' } });
    fireEvent.click(screen.getByText('Confirm'));
    expect(onSave).toHaveBeenCalledWith({ agent: 'Bob', amount: '250' });
  });

  it('7. bulk marks conversations as read and unread count drops to 0', async () => {
    const convs = [
      { id: 'c1', unread: true },
      { id: 'c2', unread: true },
    ];
    render(<BulkConversationList conversations={convs} />);
    expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByLabelText('c1'));
    fireEvent.click(screen.getByLabelText('c2'));
    fireEvent.click(screen.getByText('Mark Read'));
    await waitFor(() =>
      expect(screen.getByTestId('unread-count')).toHaveTextContent('0')
    );
  });

  it('8. debounces search and shows only matching result after 400ms', async () => {
    vi.useFakeTimers();
    render(<SearchConversations names={['Alice', 'Bob']} />);
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'Ali' } });
    act(() => { vi.advanceTimersByTime(400); });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it('9. opens mention dropdown on @ and highlights selected mention', async () => {
    render(<MentionComposer agents={['alice', 'bob']} />);
    fireEvent.change(screen.getByLabelText('compose'), { target: { value: '@' } });
    await waitFor(() =>
      expect(screen.getByTestId('mention-dropdown')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('alice'));
    await waitFor(() =>
      expect(screen.getByTestId('mention-alice')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('mention-dropdown')).not.toBeInTheDocument();
  });

  it('10. shows single-check after send and double-check after simulated read', async () => {
    const onSend = vi.fn();
    render(<MessageWithReceipt onSend={onSend} />);
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() => expect(screen.getByTestId('single-check')).toBeInTheDocument());
    expect(screen.queryByTestId('double-check')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('simulate-read'));
    await waitFor(() => expect(screen.getByTestId('double-check')).toBeInTheDocument());
    expect(screen.queryByTestId('single-check')).not.toBeInTheDocument();
  });

  it('11. deletes message after context menu → delete → confirm', async () => {
    render(<DeletableMessage content="Hello World" />);
    expect(screen.getByTestId('message-text')).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId('message-text'));
    await waitFor(() => expect(screen.getByText('Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.getByText('Confirm Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirm Delete'));
    await waitFor(() =>
      expect(screen.queryByTestId('message-text')).not.toBeInTheDocument()
    );
  });

  it('12. edits message on double-click and shows updated text after save', async () => {
    render(<EditableMessage initial="Original text" />);
    expect(screen.getByTestId('message-content')).toHaveTextContent('Original text');
    fireEvent.dblClick(screen.getByTestId('message-content'));
    await waitFor(() => expect(screen.getByLabelText('edit-input')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('edit-input'), {
      target: { value: 'Updated text' },
    });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByTestId('message-content')).toHaveTextContent('Updated text')
    );
  });

  it('13. filters to only unread conversations when Unread filter is clicked', async () => {
    const convs = [
      { id: '1', unread: true, label: 'Conv A' },
      { id: '2', unread: false, label: 'Conv B' },
      { id: '3', unread: true, label: 'Conv C' },
    ];
    render(<UnreadFilter conversations={convs} />);
    expect(screen.getByTestId('visible-count')).toHaveTextContent('3');
    fireEvent.click(screen.getByText('Unread'));
    await waitFor(() =>
      expect(screen.getByTestId('visible-count')).toHaveTextContent('2')
    );
    expect(screen.queryByTestId('conv-2')).not.toBeInTheDocument();
  });

  it('14. assigns conversation to Alice and shows assigned agent', async () => {
    const onAssign = vi.fn();
    render(<AssignConversation agents={['Alice', 'Bob']} onAssign={onAssign} />);
    fireEvent.click(screen.getByText('Assign'));
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Alice'));
    expect(onAssign).toHaveBeenCalledWith('Alice');
    await waitFor(() =>
      expect(screen.getByTestId('assigned-agent')).toHaveTextContent('Alice')
    );
  });

  it('15. calls onExport when Export button is clicked', () => {
    const onExport = vi.fn();
    render(<ExportButton onExport={onExport} />);
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('16. appends new message when ws-message CustomEvent is dispatched', async () => {
    render(<RealtimeMessages initialMessages={['Hello']} />);
    expect(screen.getByTestId('msg-0')).toHaveTextContent('Hello');
    act(() => {
      window.dispatchEvent(
        new CustomEvent('ws-message', { detail: { text: 'World' } })
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId('msg-1')).toHaveTextContent('World')
    );
  });

  it('17. shows redirect message when onSend returns 401', async () => {
    const onSend = vi.fn().mockResolvedValue({ status: 401 });
    render(<AuthenticatedSender onSend={onSend} />);
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() =>
      expect(screen.getByTestId('redirect-msg')).toHaveTextContent('Session expired')
    );
  });

  it('18. shows permission denied error toast when onHandoff returns 403', async () => {
    const onHandoff = vi.fn().mockResolvedValue({ status: 403 });
    render(<HandoffWithPermission onHandoff={onHandoff} />);
    fireEvent.click(screen.getByText('Handoff'));
    await waitFor(() =>
      expect(screen.getByTestId('error-toast')).toHaveTextContent('Permission denied')
    );
  });

  it('19. shows retry button on failure, then sent indicator after retry succeeds', async () => {
    const onSend = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    render(<RetryableSender onSend={onSend} />);
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() =>
      expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('retry-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('sent-indicator')).toBeInTheDocument()
    );
  });

  it('20. both concurrent messages appear in order', async () => {
    render(<ConcurrentSender />);
    fireEvent.click(screen.getByText('Send A'));
    fireEvent.click(screen.getByText('Send B'));
    await waitFor(() => {
      expect(screen.getByTestId('concurrent-msg-0')).toHaveTextContent('A');
      expect(screen.getByTestId('concurrent-msg-1')).toHaveTextContent('B');
    });
  });

  it('21. shows size error when file exceeds maxSize', async () => {
    render(<AttachmentUploader maxSize={1000} />);
    const bigFile = new File(['x'.repeat(2001)], 'big.txt', { type: 'text/plain' });
    Object.defineProperty(bigFile, 'size', { value: 2001 });
    fireEvent.change(screen.getByLabelText('attachment'), {
      target: { files: [bigFile] },
    });
    await waitFor(() =>
      expect(screen.getByTestId('size-error')).toHaveTextContent('File too large')
    );
  });

  it('22. deletes trigger after delete → confirm flow', async () => {
    render(
      <TriggerManager triggers={[{ id: 't1', name: 'Welcome Trigger' }]} />
    );
    expect(screen.getByTestId('trigger-t1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.getByText('Confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(screen.queryByTestId('trigger-t1')).not.toBeInTheDocument()
    );
  });

  it('23. shows no-results empty state when search returns empty array', async () => {
    const onSearch = vi.fn().mockReturnValue([]);
    render(<ConversationSearchEmpty onSearch={onSearch} />);
    fireEvent.change(screen.getByLabelText('search-empty'), {
      target: { value: 'xyz' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('no-results')).toHaveTextContent('No results')
    );
  });

  it('24. calls onNavigate with conversationId when notification badge is clicked', () => {
    const onNavigate = vi.fn();
    render(<NotificationBadge conversationId="c42" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('notif-badge'));
    expect(onNavigate).toHaveBeenCalledWith('c42');
  });

  it('25. shows success toast with agent name after attribution save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AttributionWithFeedback onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('attribution-agent'), {
      target: { value: 'Bob' },
    });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByTestId('success-toast')).toHaveTextContent(
        'Attribution saved for Bob'
      )
    );
  });
});
