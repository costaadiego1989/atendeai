import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ContactsFilters } from './ContactsFilters';

describe('ContactsFilters Component', () => {
  const defaultProps = {
    search: '',
    onSearchChange: vi.fn(),
    stageFilter: 'ALL',
    onStageFilterChange: vi.fn(),
    stageOptions: [{ value: 'ALL', label: 'Todos' }],
  };

  it('renders without totalCount badge when not provided', () => {
    const { queryByText } = render(<ContactsFilters {...defaultProps} />);
    expect(queryByText(/resultados/i)).not.toBeInTheDocument();
  });

  it('renders totalCount badge when provided', () => {
    const { getByText } = render(<ContactsFilters {...defaultProps} totalCount={42} />);
    expect(getByText('42')).toBeInTheDocument();
    expect(getByText(/resultados/i)).toBeInTheDocument();
  });

  it('renders singular "resultado" when totalCount is 1', () => {
    const { getByText } = render(<ContactsFilters {...defaultProps} totalCount={1} />);
    expect(getByText('1')).toBeInTheDocument();
    expect(getByText(/resultado$/i)).toBeInTheDocument();
  });
});
