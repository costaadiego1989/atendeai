import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  })),
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));
vi.mock('../GlobalConversationNotifier', () => ({ default: vi.fn() }));
vi.mock('../SaleAttributionDialog', () => ({ default: vi.fn() }));
vi.mock('../MessageThread', () => ({ default: vi.fn() }));
vi.mock('../HandoffControl', () => ({ default: vi.fn() }));
vi.mock('../AutomationTrigger', () => ({ default: vi.fn() }));
vi.mock('../FileAttachment', () => ({ default: vi.fn() }));

import GlobalConversationNotifier from '../GlobalConversationNotifier';
import SaleAttributionDialog from '../SaleAttributionDialog';
import MessageThread from '../MessageThread';
import HandoffControl from '../HandoffControl';
import AutomationTrigger from '../AutomationTrigger';
import FileAttachment from '../FileAttachment';

// Cast mocks for use in tests
const MockGCN = GlobalConversationNotifier as unknown as ReturnType<typeof vi.fn>;
const MockSAD = SaleAttributionDialog as unknown as ReturnType<typeof vi.fn>;
const MockMT = MessageThread as unknown as ReturnType<typeof vi.fn>;
const MockHC = HandoffControl as unknown as ReturnType<typeof vi.fn>;
const MockAT = AutomationTrigger as unknown as ReturnType<typeof vi.fn>;
const MockFA = FileAttachment as unknown as ReturnType<typeof vi.fn>;
