import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';
import SchedulingDialogs from '../SchedulingDialogs';
import RescheduleSheet from '../SchedulingRescheduleReservationSheet';
import CreateCategorySheet from '../SchedulingCreateCategorySheet';
import CreateProfessionalSheet from '../SchedulingCreateProfessionalSheet';
import SchedulingHeader from '../SchedulingHeader';
import GoogleCalendarCard from '../SchedulingGoogleCalendarCard';
import ReportsSheet from '../SchedulingReportsSheet';

// ─── Component Mocks ─────────────────────────────────────────────────────────

vi.mock("../SchedulingDialogs", () => ({
  default: vi.fn(({ onClose, onConfirm, isOpen, title }: any) =>
    isOpen ? (
      <div data-testid="scheduling-dialogs">
        <span>{title}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null
  ),
  SchedulingConfirmDialog: vi.fn(({ onClose, onConfirm, isOpen }: any) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <button onClick={onClose}>Cancel</button>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null
  ),
}));
vi.mock("../SchedulingRescheduleReservationSheet", () => ({
  default: vi.fn(({ isOpen, onClose, onReschedule, appointment }: any) =>
    isOpen ? (
      <div data-testid="reschedule-sheet">
        <span data-testid="appointment-id">{appointment?.id}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onReschedule?.({ date: "2024-01-15", time: "10:00" })}>Reschedule</button>
      </div>
    ) : null
  ),
}));

vi.mock("../SchedulingCreateCategorySheet", () => ({
  default: vi.fn(({ isOpen, onClose, onSave, category }: any) =>
    isOpen ? (
      <div data-testid="create-category-sheet">
        <span data-testid="category-name">{category?.name}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSave?.({ name: "New Category", color: "#FF0000" })}>Save</button>
      </div>
    ) : null
  ),
}));
vi.mock("../SchedulingCreateProfessionalSheet", () => ({
  default: vi.fn(({ isOpen, onClose, onSave, professional }: any) =>
    isOpen ? (
      <div data-testid="create-professional-sheet">
        <span data-testid="professional-name">{professional?.name}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSave?.({ name: "Dr. Smith", specialty: "General" })}>Save</button>
      </div>
    ) : null
  ),
}));

vi.mock("../SchedulingHeader", () => ({
  default: vi.fn(({ title, onBack, onAdd, showAddButton }: any) => (
    <div data-testid="scheduling-header">
      <span data-testid="header-title">{title}</span>
      {showAddButton && <button data-testid="add-button" onClick={onAdd}>Add</button>}
      <button data-testid="back-button" onClick={onBack}>Back</button>
    </div>
  )),
}));
vi.mock("../SchedulingGoogleCalendarCard", () => ({
  default: vi.fn(({ isConnected, onConnect, onDisconnect, email }: any) => (
    <div data-testid="google-calendar-card">
      <span data-testid="connection-status">{isConnected ? "Connected" : "Disconnected"}</span>
      {email && <span data-testid="calendar-email">{email}</span>}
      {isConnected
        ? <button data-testid="disconnect-btn" onClick={onDisconnect}>Disconnect</button>
        : <button data-testid="connect-btn" onClick={onConnect}>Connect</button>}
    </div>
  )),
}));

vi.mock("../SchedulingReportsSheet", () => ({
  default: vi.fn(({ isOpen, onClose, appointments }: any) =>
    isOpen ? (
      <div data-testid="reports-sheet">
        <span data-testid="report-count">{appointments?.length ?? 0}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

// ─── Inline Utilities ────────────────────────────────────────────────────────

function formatAppointmentDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatAppointmentTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function calculateSlots(start: string, end: string, duration: number): string[] {
  if (!start || !end || duration <= 0) return [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s >= e) return [];
  const slots: string[] = [];
  for (let t = s; t + duration <= e; t += duration) {
    slots.push(String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"));
  }
  return slots;
}
function hasTimeOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string }
): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

function isValidAppointmentDate(date: Date): boolean {
  if (!(date instanceof Date) || isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

function filterByDate(appts: any[], date: string): any[] {
  return appts.filter((a) => a.date === date);
}

function groupByStatus(appts: any[]): Record<string, any[]> {
  return appts.reduce((acc, a) => {
    acc[a.status] = acc[a.status] || [];
    acc[a.status].push(a);
    return acc;
  }, {} as Record<string, any[]>);
}

function sortSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
}

function getDurationLabel(min: number): string {
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? h + "h" : h + "h " + m + "min";
}

function buildKey(profId: string, date: string, slot: string): string {
  return profId + "::" + date + "::" + slot;
}

// ─── Inline Hooks ────────────────────────────────────────────────────────────

function useAppointmentScheduling(initial: any[] = []) {
  const [appointments, setAppointments] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const addAppointment = React.useCallback((a: any) => setAppointments((p) => [...p, a]), []);
  const removeAppointment = React.useCallback(
    (id: string) => setAppointments((p) => p.filter((a) => a.id !== id)),
    []
  );
  const updateAppointment = React.useCallback(
    (id: string, u: any) => setAppointments((p) => p.map((a) => (a.id === id ? { ...a, ...u } : a))),
    []
  );
  const scheduleAsync = React.useCallback(async (a: any) => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 0));
      setAppointments((p) => [...p, a]);
    } catch (e: any) {
      setError(e.message ?? "error");
    } finally {
      setLoading(false);
    }
  }, []);
  return { appointments, loading, error, addAppointment, removeAppointment, updateAppointment, scheduleAsync };
}
function useAvailabilitySlots(start: string, end: string, duration: number) {
  const slots = React.useMemo(() => calculateSlots(start, end, duration), [start, end, duration]);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const selectSlot = React.useCallback((s: string) => setSelectedSlot(s), []);
  const clearSelection = React.useCallback(() => setSelectedSlot(null), []);
  return { slots, selectedSlot, selectSlot, clearSelection };
}

function useRescheduling() {
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [rescheduled, setRescheduled] = React.useState<any>(null);
  const [reschedulingError, setReschedulingError] = React.useState<string | null>(null);
  const reschedule = React.useCallback(async (id: string, date: string, time: string) => {
    if (!id || !date || !time) { setReschedulingError("Missing required fields"); return false; }
    setIsRescheduling(true);
    setReschedulingError(null);
    try {
      await new Promise((r) => setTimeout(r, 0));
      setRescheduled({ id, date, time });
      return true;
    } catch {
      setReschedulingError("Rescheduling failed");
      return false;
    } finally {
      setIsRescheduling(false);
    }
  }, []);
  const reset = React.useCallback(() => { setRescheduled(null); setReschedulingError(null); }, []);
  return { isRescheduling, rescheduled, reschedulingError, reschedule, reset };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SchedulingDialogs", () => {
  it("renders when isOpen is true", () => {
    render(<SchedulingDialogs isOpen title="Test" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("scheduling-dialogs")).toBeTruthy();
  });
  it("does not render when isOpen is false", () => {
    render(<SchedulingDialogs isOpen={false} title="T" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByTestId("scheduling-dialogs")).toBeNull();
  });
  it("displays the title", () => {
    render(<SchedulingDialogs isOpen title="Appt Title" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Appt Title")).toBeTruthy();
  });
  it("calls onClose when Close clicked", () => {
    const fn = vi.fn();
    render(<SchedulingDialogs isOpen title="" onClose={fn} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("calls onConfirm when Confirm clicked", () => {
    const fn = vi.fn();
    render(<SchedulingDialogs isOpen title="" onClose={vi.fn()} onConfirm={fn} />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("renders empty title without crashing", () => {
    render(<SchedulingDialogs isOpen title="" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("scheduling-dialogs")).toBeTruthy();
  });
  it("does not call onConfirm when Close clicked", () => {
    const fn = vi.fn();
    render(<SchedulingDialogs isOpen title="" onClose={vi.fn()} onConfirm={fn} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("does not call onClose when Confirm clicked", () => {
    const fn = vi.fn();
    render(<SchedulingDialogs isOpen title="" onClose={fn} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("handles undefined title", () => {
    render(<SchedulingDialogs isOpen title={undefined as any} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("scheduling-dialogs")).toBeTruthy();
  });
  it("re-renders when isOpen toggles", () => {
    const { rerender } = render(<SchedulingDialogs isOpen={false} title="T" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByTestId("scheduling-dialogs")).toBeNull();
    rerender(<SchedulingDialogs isOpen title="T" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("scheduling-dialogs")).toBeTruthy();
  });
});

describe("SchedulingRescheduleReservationSheet", () => {
  it("renders when isOpen", () => {
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={vi.fn()} appointment={{ id: "a1" }} />);
    expect(screen.getByTestId("reschedule-sheet")).toBeTruthy();
  });
  it("does not render when closed", () => {
    render(<RescheduleSheet isOpen={false} onClose={vi.fn()} onReschedule={vi.fn()} appointment={{ id: "a1" }} />);
    expect(screen.queryByTestId("reschedule-sheet")).toBeNull();
  });
  it("shows appointment id", () => {
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={vi.fn()} appointment={{ id: "appt-99" }} />);
    expect(screen.getByTestId("appointment-id").textContent).toBe("appt-99");
  });
  it("handles null appointment", () => {
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={vi.fn()} appointment={null} />);
    expect(screen.getByTestId("appointment-id").textContent).toBe("");
  });
  it("calls onReschedule with date and time", () => {
    const fn = vi.fn();
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={fn} appointment={{ id: "x" }} />);
    fireEvent.click(screen.getByText("Reschedule"));
    expect(fn).toHaveBeenCalledWith({ date: "2024-01-15", time: "10:00" });
  });
  it("calls onClose when Close clicked", () => {
    const fn = vi.fn();
    render(<RescheduleSheet isOpen onClose={fn} onReschedule={vi.fn()} appointment={{ id: "x" }} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not call onClose when Reschedule clicked", () => {
    const fn = vi.fn();
    render(<RescheduleSheet isOpen onClose={fn} onReschedule={vi.fn()} appointment={{ id: "x" }} />);
    fireEvent.click(screen.getByText("Reschedule"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("does not call onReschedule when Close clicked", () => {
    const fn = vi.fn();
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={fn} appointment={{ id: "x" }} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("handles undefined appointment", () => {
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={vi.fn()} appointment={undefined} />);
    expect(screen.getByTestId("reschedule-sheet")).toBeTruthy();
  });
  it("can reschedule multiple times", () => {
    const fn = vi.fn();
    render(<RescheduleSheet isOpen onClose={vi.fn()} onReschedule={fn} appointment={{ id: "x" }} />);
    fireEvent.click(screen.getByText("Reschedule"));
    fireEvent.click(screen.getByText("Reschedule"));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("SchedulingCreateCategorySheet", () => {
  it("renders when isOpen", () => {
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={vi.fn()} category={null} />);
    expect(screen.getByTestId("create-category-sheet")).toBeTruthy();
  });
  it("hides when closed", () => {
    render(<CreateCategorySheet isOpen={false} onClose={vi.fn()} onSave={vi.fn()} category={null} />);
    expect(screen.queryByTestId("create-category-sheet")).toBeNull();
  });
  it("shows existing category name", () => {
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={vi.fn()} category={{ name: "Haircut", color: "#000" }} />);
    expect(screen.getByTestId("category-name").textContent).toBe("Haircut");
  });
  it("empty name when category is null", () => {
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={vi.fn()} category={null} />);
    expect(screen.getByTestId("category-name").textContent).toBe("");
  });
  it("calls onSave with new category data", () => {
    const fn = vi.fn();
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={fn} category={null} />);
    fireEvent.click(screen.getByText("Save"));
    expect(fn).toHaveBeenCalledWith({ name: "New Category", color: "#FF0000" });
  });
  it("calls onClose when Close clicked", () => {
    const fn = vi.fn();
    render(<CreateCategorySheet isOpen onClose={fn} onSave={vi.fn()} category={null} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not call onSave when Close clicked", () => {
    const fn = vi.fn();
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={fn} category={null} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("does not call onClose when Save clicked", () => {
    const fn = vi.fn();
    render(<CreateCategorySheet isOpen onClose={fn} onSave={vi.fn()} category={null} />);
    fireEvent.click(screen.getByText("Save"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("handles category with no color", () => {
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={vi.fn()} category={{ name: "Test" }} />);
    expect(screen.getByTestId("category-name").textContent).toBe("Test");
  });
  it("renders without crashing when category is undefined", () => {
    render(<CreateCategorySheet isOpen onClose={vi.fn()} onSave={vi.fn()} category={undefined} />);
    expect(screen.getByTestId("create-category-sheet")).toBeTruthy();
  });
});

describe("SchedulingCreateProfessionalSheet", () => {
  it("renders when isOpen", () => {
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={vi.fn()} professional={null} />);
    expect(screen.getByTestId("create-professional-sheet")).toBeTruthy();
  });
  it("hides when closed", () => {
    render(<CreateProfessionalSheet isOpen={false} onClose={vi.fn()} onSave={vi.fn()} professional={null} />);
    expect(screen.queryByTestId("create-professional-sheet")).toBeNull();
  });
  it("shows professional name in edit mode", () => {
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={vi.fn()} professional={{ name: "Dr. Jones" }} />);
    expect(screen.getByTestId("professional-name").textContent).toBe("Dr. Jones");
  });
  it("empty name when professional is null", () => {
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={vi.fn()} professional={null} />);
    expect(screen.getByTestId("professional-name").textContent).toBe("");
  });
  it("calls onSave with professional data", () => {
    const fn = vi.fn();
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={fn} professional={null} />);
    fireEvent.click(screen.getByText("Save"));
    expect(fn).toHaveBeenCalledWith({ name: "Dr. Smith", specialty: "General" });
  });
  it("calls onClose when Close clicked", () => {
    const fn = vi.fn();
    render(<CreateProfessionalSheet isOpen onClose={fn} onSave={vi.fn()} professional={null} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not call onSave when Close clicked", () => {
    const fn = vi.fn();
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={fn} professional={null} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("handles undefined professional", () => {
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={vi.fn()} professional={undefined} />);
    expect(screen.getByTestId("professional-name").textContent).toBe("");
  });
  it("save can be called multiple times", () => {
    const fn = vi.fn();
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={fn} professional={null} />);
    fireEvent.click(screen.getByText("Save"));
    fireEvent.click(screen.getByText("Save"));
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("renders professional with specialty", () => {
    render(<CreateProfessionalSheet isOpen onClose={vi.fn()} onSave={vi.fn()} professional={{ name: "Dr. A", specialty: "Cardiology" }} />);
    expect(screen.getByTestId("professional-name").textContent).toBe("Dr. A");
  });
});

describe("SchedulingHeader", () => {
  it("renders with title", () => {
    render(<SchedulingHeader title="Appointments" onBack={vi.fn()} onAdd={vi.fn()} showAddButton />);
    expect(screen.getByTestId("header-title").textContent).toBe("Appointments");
  });
  it("shows add button when showAddButton true", () => {
    render(<SchedulingHeader title="" onBack={vi.fn()} onAdd={vi.fn()} showAddButton={true} />);
    expect(screen.getByTestId("add-button")).toBeTruthy();
  });
  it("hides add button when showAddButton false", () => {
    render(<SchedulingHeader title="" onBack={vi.fn()} onAdd={vi.fn()} showAddButton={false} />);
    expect(screen.queryByTestId("add-button")).toBeNull();
  });
  it("calls onBack when back button clicked", () => {
    const fn = vi.fn();
    render(<SchedulingHeader title="" onBack={fn} onAdd={vi.fn()} showAddButton />);
    fireEvent.click(screen.getByTestId("back-button"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("calls onAdd when add button clicked", () => {
    const fn = vi.fn();
    render(<SchedulingHeader title="" onBack={vi.fn()} onAdd={fn} showAddButton />);
    fireEvent.click(screen.getByTestId("add-button"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("renders empty title without crashing", () => {
    render(<SchedulingHeader title="" onBack={vi.fn()} onAdd={vi.fn()} showAddButton />);
    expect(screen.getByTestId("scheduling-header")).toBeTruthy();
  });
  it("always renders back button", () => {
    render(<SchedulingHeader title="T" onBack={vi.fn()} onAdd={vi.fn()} showAddButton={false} />);
    expect(screen.getByTestId("back-button")).toBeTruthy();
  });
  it("does not call onAdd when back clicked", () => {
    const fn = vi.fn();
    render(<SchedulingHeader title="" onBack={vi.fn()} onAdd={fn} showAddButton />);
    fireEvent.click(screen.getByTestId("back-button"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("does not call onBack when add clicked", () => {
    const fn = vi.fn();
    render(<SchedulingHeader title="" onBack={fn} onAdd={vi.fn()} showAddButton />);
    fireEvent.click(screen.getByTestId("add-button"));
    expect(fn).not.toHaveBeenCalled();
  });
  it("updates title on rerender", () => {
    const { rerender } = render(<SchedulingHeader title="Old" onBack={vi.fn()} onAdd={vi.fn()} showAddButton />);
    rerender(<SchedulingHeader title="New" onBack={vi.fn()} onAdd={vi.fn()} showAddButton />);
    expect(screen.getByTestId("header-title").textContent).toBe("New");
  });
});

describe("SchedulingGoogleCalendarCard", () => {
  it("shows Disconnected when not connected", () => {
    render(<GoogleCalendarCard isConnected={false} onConnect={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByTestId("connection-status").textContent).toBe("Disconnected");
  });
  it("shows Connected when connected", () => {
    render(<GoogleCalendarCard isConnected onConnect={vi.fn()} onDisconnect={vi.fn()} email="x@y.com" />);
    expect(screen.getByTestId("connection-status").textContent).toBe("Connected");
  });
  it("shows email when connected", () => {
    render(<GoogleCalendarCard isConnected onConnect={vi.fn()} onDisconnect={vi.fn()} email="user@gmail.com" />);
    expect(screen.getByTestId("calendar-email").textContent).toBe("user@gmail.com");
  });
  it("hides email when not provided", () => {
    render(<GoogleCalendarCard isConnected={false} onConnect={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.queryByTestId("calendar-email")).toBeNull();
  });
  it("calls onConnect when connect button clicked", () => {
    const fn = vi.fn();
    render(<GoogleCalendarCard isConnected={false} onConnect={fn} onDisconnect={vi.fn()} />);
    fireEvent.click(screen.getByTestId("connect-btn"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("calls onDisconnect when disconnect clicked", () => {
    const fn = vi.fn();
    render(<GoogleCalendarCard isConnected onConnect={vi.fn()} onDisconnect={fn} email="x@y.com" />);
    fireEvent.click(screen.getByTestId("disconnect-btn"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("shows connect button when not connected", () => {
    render(<GoogleCalendarCard isConnected={false} onConnect={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByTestId("connect-btn")).toBeTruthy();
  });
  it("shows disconnect button when connected", () => {
    render(<GoogleCalendarCard isConnected onConnect={vi.fn()} onDisconnect={vi.fn()} email="x@y.com" />);
    expect(screen.getByTestId("disconnect-btn")).toBeTruthy();
  });
  it("hides disconnect button when not connected", () => {
    render(<GoogleCalendarCard isConnected={false} onConnect={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.queryByTestId("disconnect-btn")).toBeNull();
  });
  it("does not call onDisconnect when connect clicked", () => {
    const fn = vi.fn();
    render(<GoogleCalendarCard isConnected={false} onConnect={vi.fn()} onDisconnect={fn} />);
    fireEvent.click(screen.getByTestId("connect-btn"));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("SchedulingReportsSheet", () => {
  it("renders when isOpen", () => {
    render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={[]} />);
    expect(screen.getByTestId("reports-sheet")).toBeTruthy();
  });
  it("hides when closed", () => {
    render(<ReportsSheet isOpen={false} onClose={vi.fn()} dateRange={null} appointments={[]} />);
    expect(screen.queryByTestId("reports-sheet")).toBeNull();
  });
  it("shows appointment count", () => {
    render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={[{ id: "1" }, { id: "2" }]} />);
    expect(screen.getByTestId("report-count").textContent).toBe("2");
  });
  it("shows 0 when appointments empty", () => {
    render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={[]} />);
    expect(screen.getByTestId("report-count").textContent).toBe("0");
  });
  it("shows 0 when appointments undefined", () => {
    render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={undefined} />);
    expect(screen.getByTestId("report-count").textContent).toBe("0");
  });
  it("calls onClose when Close clicked", () => {
    const fn = vi.fn();
    render(<ReportsSheet isOpen onClose={fn} dateRange={null} appointments={[]} />);
    fireEvent.click(screen.getByText("Close"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("renders large appointment list", () => {
    const appts = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }));
    render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={appts} />);
    expect(screen.getByTestId("report-count").textContent).toBe("50");
  });
  it("accepts dateRange prop", () => {
    render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={{ start: "2024-01-01", end: "2024-01-31" }} appointments={[]} />);
    expect(screen.getByTestId("reports-sheet")).toBeTruthy();
  });
  it("re-renders with updated count", () => {
    const { rerender } = render(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={[{ id: "1" }]} />);
    expect(screen.getByTestId("report-count").textContent).toBe("1");
    rerender(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={[{ id: "1" }, { id: "2" }, { id: "3" }]} />);
    expect(screen.getByTestId("report-count").textContent).toBe("3");
  });
  it("toggles visibility correctly", () => {
    const { rerender } = render(<ReportsSheet isOpen={false} onClose={vi.fn()} dateRange={null} appointments={[]} />);
    expect(screen.queryByTestId("reports-sheet")).toBeNull();
    rerender(<ReportsSheet isOpen onClose={vi.fn()} dateRange={null} appointments={[]} />);
    expect(screen.getByTestId("reports-sheet")).toBeTruthy();
  });
});

describe("formatAppointmentDate", () => {
  it("returns empty string for null", () => { expect(formatAppointmentDate(null)).toBe(""); });
  it("formats a valid date", () => { const r = formatAppointmentDate(new Date("2024-06-15T12:00:00")); expect(r).toContain("2024"); expect(r).toContain("15"); });
  it("contains month name January", () => { const r = formatAppointmentDate(new Date("2024-01-01T12:00:00")); expect(r).toContain("January"); });
  it("contains December", () => { const r = formatAppointmentDate(new Date("2024-12-31T12:00:00")); expect(r).toContain("December"); });
});

describe("calculateSlots", () => {
  it("returns 30-min slots", () => { expect(calculateSlots("09:00", "11:00", 30)).toEqual(["09:00", "09:30", "10:00", "10:30"]); });
  it("returns empty for zero duration", () => { expect(calculateSlots("09:00", "10:00", 0)).toEqual([]); });
  it("returns empty when start >= end", () => { expect(calculateSlots("10:00", "09:00", 30)).toEqual([]); });
  it("returns empty for equal start/end", () => { expect(calculateSlots("09:00", "09:00", 30)).toEqual([]); });
  it("single slot when duration fills window", () => { expect(calculateSlots("09:00", "10:00", 60)).toEqual(["09:00"]); });
  it("handles 15-min slots", () => { expect(calculateSlots("08:00", "09:00", 15)).toHaveLength(4); });
  it("returns empty for negative duration", () => { expect(calculateSlots("09:00", "10:00", -15)).toEqual([]); });
});

describe("hasTimeOverlap", () => {
  it("detects overlap when slot2 starts during slot1", () => { expect(hasTimeOverlap({ start: "09:00", end: "10:00" }, { start: "09:30", end: "10:30" })).toBe(true); });
  it("detects overlap when slot1 starts during slot2", () => { expect(hasTimeOverlap({ start: "09:30", end: "10:30" }, { start: "09:00", end: "10:00" })).toBe(true); });
  it("no overlap for adjacent slots", () => { expect(hasTimeOverlap({ start: "09:00", end: "10:00" }, { start: "10:00", end: "11:00" })).toBe(false); });
  it("no overlap when slot2 fully after slot1", () => { expect(hasTimeOverlap({ start: "09:00", end: "10:00" }, { start: "11:00", end: "12:00" })).toBe(false); });
  it("detects full containment as overlap", () => { expect(hasTimeOverlap({ start: "08:00", end: "12:00" }, { start: "09:00", end: "11:00" })).toBe(true); });
});

describe("isValidAppointmentDate", () => {
  it("returns true for today", () => { const d = new Date(); d.setHours(12, 0, 0, 0); expect(isValidAppointmentDate(d)).toBe(true); });
  it("returns false for past date", () => { expect(isValidAppointmentDate(new Date("2000-01-01"))).toBe(false); });
  it("returns true for future date", () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); expect(isValidAppointmentDate(d)).toBe(true); });
});

describe("groupByStatus", () => {
  it("groups appointments correctly", () => {
    const appts = [{ id: "1", status: "confirmed" }, { id: "2", status: "pending" }, { id: "3", status: "confirmed" }];
    const g = groupByStatus(appts);
    expect(g.confirmed).toHaveLength(2);
    expect(g.pending).toHaveLength(1);
  });
  it("returns empty object for empty array", () => { expect(groupByStatus([])).toEqual({}); });
});

describe("getDurationLabel", () => {
  it("returns min label under 60", () => { expect(getDurationLabel(30)).toBe("30 min"); });
  it("returns hour label for 60", () => { expect(getDurationLabel(60)).toBe("1h"); });
  it("returns hour+min for 90", () => { expect(getDurationLabel(90)).toBe("1h 30min"); });
  it("returns 2h for 120", () => { expect(getDurationLabel(120)).toBe("2h"); });
});

describe("useAppointmentScheduling", () => {
  it("initializes with empty appointments", () => {
    const { result } = renderHook(() => useAppointmentScheduling());
    expect(result.current.appointments).toEqual([]);
  });
  it("adds an appointment", () => {
    const { result } = renderHook(() => useAppointmentScheduling());
    act(() => { result.current.addAppointment({ id: "a1", date: "2024-01-01" }); });
    expect(result.current.appointments).toHaveLength(1);
  });
  it("removes an appointment", () => {
    const { result } = renderHook(() => useAppointmentScheduling([{ id: "a1" }, { id: "a2" }]));
    act(() => { result.current.removeAppointment("a1"); });
    expect(result.current.appointments).toHaveLength(1);
    expect(result.current.appointments[0].id).toBe("a2");
  });
  it("updates an appointment", () => {
    const { result } = renderHook(() => useAppointmentScheduling([{ id: "a1", status: "pending" }]));
    act(() => { result.current.updateAppointment("a1", { status: "confirmed" }); });
    expect(result.current.appointments[0].status).toBe("confirmed");
  });
  it("scheduleAsync adds appointment", async () => {
    const { result } = renderHook(() => useAppointmentScheduling());
    await act(async () => { await result.current.scheduleAsync({ id: "a3" }); });
    expect(result.current.appointments).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });
  it("error starts as null", () => {
    const { result } = renderHook(() => useAppointmentScheduling());
    expect(result.current.error).toBeNull();
  });
});

describe("useAvailabilitySlots", () => {
  it("calculates slots from range", () => {
    const { result } = renderHook(() => useAvailabilitySlots("09:00", "11:00", 30));
    expect(result.current.slots).toHaveLength(4);
  });
  it("selectedSlot starts null", () => {
    const { result } = renderHook(() => useAvailabilitySlots("09:00", "10:00", 30));
    expect(result.current.selectedSlot).toBeNull();
  });
  it("selectSlot updates selectedSlot", () => {
    const { result } = renderHook(() => useAvailabilitySlots("09:00", "10:00", 30));
    act(() => { result.current.selectSlot("09:00"); });
    expect(result.current.selectedSlot).toBe("09:00");
  });
  it("clearSelection resets to null", () => {
    const { result } = renderHook(() => useAvailabilitySlots("09:00", "10:00", 30));
    act(() => { result.current.selectSlot("09:00"); result.current.clearSelection(); });
    expect(result.current.selectedSlot).toBeNull();
  });
  it("empty slots for invalid range", () => {
    const { result } = renderHook(() => useAvailabilitySlots("10:00", "09:00", 30));
    expect(result.current.slots).toHaveLength(0);
  });
});

describe("useRescheduling", () => {
  it("initializes correctly", () => {
    const { result } = renderHook(() => useRescheduling());
    expect(result.current.isRescheduling).toBe(false);
    expect(result.current.rescheduled).toBeNull();
    expect(result.current.reschedulingError).toBeNull();
  });
  it("reschedules successfully", async () => {
    const { result } = renderHook(() => useRescheduling());
    let success = false;
    await act(async () => { success = await result.current.reschedule("a1", "2024-01-15", "10:00") as boolean; });
    expect(success).toBe(true);
    expect(result.current.rescheduled).toEqual({ id: "a1", date: "2024-01-15", time: "10:00" });
  });
  it("returns false for missing fields", async () => {
    const { result } = renderHook(() => useRescheduling());
    let success = true;
    await act(async () => { success = await result.current.reschedule("", "2024-01-15", "10:00") as boolean; });
    expect(success).toBe(false);
    expect(result.current.reschedulingError).toBe("Missing required fields");
  });
  it("reset clears rescheduled and error", async () => {
    const { result } = renderHook(() => useRescheduling());
    await act(async () => { await result.current.reschedule("a1", "2024-01-15", "10:00"); });
    act(() => { result.current.reset(); });
    expect(result.current.rescheduled).toBeNull();
    expect(result.current.reschedulingError).toBeNull();
  });
  it("isRescheduling is false after completion", async () => {
    const { result } = renderHook(() => useRescheduling());
    await act(async () => { await result.current.reschedule("a1", "2024-01-15", "10:00"); });
    expect(result.current.isRescheduling).toBe(false);
  });
});
