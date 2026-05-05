import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface AppPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  currentItemsCount: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

export function AppPagination({
  page,
  totalPages,
  totalItems,
  currentItemsCount,
  itemLabel = 'itens',
  onPageChange,
  className = '',
}: AppPaginationProps) {
  const visiblePages = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2));

  return (
    <div
      className={`flex flex-col gap-3 border-t border-border/60 pt-4 lg:flex-row lg:items-center lg:justify-between ${className}`}
    >
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{currentItemsCount}</span> de{' '}
        <span className="font-medium text-foreground">{totalItems}</span> {itemLabel}. Pagina{' '}
        <span className="font-medium text-foreground">{page}</span> de{' '}
        <span className="font-medium text-foreground">{totalPages}</span>.
      </p>

      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              onClick={(event) => {
                event.preventDefault();
                if (page > 1) {
                  onPageChange(page - 1);
                }
              }}
            />
          </PaginationItem>

          {visiblePages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                isActive={page === pageNumber}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(pageNumber);
                }}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
              onClick={(event) => {
                event.preventDefault();
                if (page < totalPages) {
                  onPageChange(page + 1);
                }
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
