import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndo } from './useUndo';

describe('useUndo Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initially has no pending action', () => {
    const { result } = renderHook(() => useUndo());
    expect(result.current.hasPending).toBe(false);
  });

  it('triggers action after delay if not undone', () => {
    const actionMock = vi.fn();
    const { result } = renderHook(() => useUndo());

    act(() => {
      result.current.executeWithUndo({
        action: actionMock,
        delayMs: 3000,
      });
    });

    expect(result.current.hasPending).toBe(true);
    expect(actionMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(actionMock).toHaveBeenCalled();
    expect(result.current.hasPending).toBe(false);
  });

  it('cancels action if undone before delay', () => {
    const actionMock = vi.fn();
    const { result } = renderHook(() => useUndo());

    act(() => {
      result.current.executeWithUndo({
        action: actionMock,
        delayMs: 3000,
      });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
      result.current.undo();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(actionMock).not.toHaveBeenCalled();
    expect(result.current.hasPending).toBe(false);
  });

  it('allows immediate flush of pending action', () => {
    const actionMock = vi.fn();
    const { result } = renderHook(() => useUndo());

    act(() => {
      result.current.executeWithUndo({
        action: actionMock,
        delayMs: 3000,
      });
    });

    act(() => {
      result.current.flush();
    });

    expect(actionMock).toHaveBeenCalled();
    expect(result.current.hasPending).toBe(false);
  });
});
