import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TableSkeleton, CardSkeleton, PageSkeleton } from '@/shared/ui/Skeletons';

describe('Skeletons UI Components', () => {
  it('renders TableSkeleton with default rows and cols', () => {
    const { container } = render(<TableSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders TableSkeleton with custom rows and cols', () => {
    const { container } = render(<TableSkeleton rows={2} cols={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders CardSkeleton', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('.glass-card')).toBeInTheDocument();

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3); // 3 placeholder lines
  });

  it('renders PageSkeleton', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelector('.page-container')).toBeInTheDocument();
    expect(container.querySelector('.card-grid')).toBeInTheDocument();

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
