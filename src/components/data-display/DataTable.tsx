import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Download, Search, SearchX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/feedback/Feedback'
import { exportCsv, timestampedName } from '@/lib/export'
import { usePreferences } from '@/app/state/preferences'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------- public API */

export interface DataColumn<T> {
  id: string
  header: string
  /** Raw value used for sorting, searching and CSV export. */
  accessor: (row: T) => string | number | boolean | null | undefined
  /** Custom cell renderer (defaults to the accessor value). */
  cell?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Hidden by default (user can show it from the Columns menu). */
  defaultHidden?: boolean
  /** Prevent hiding (e.g. the primary identifier). */
  alwaysVisible?: boolean
  /** Include in the search box (default true for string values). */
  searchable?: boolean
  /** Exclude from CSV export. */
  noExport?: boolean
  exportValue?: (row: T) => string | number | boolean | null | undefined
  className?: string
  /** Footer content, e.g. a total. */
  footer?: ReactNode
}

export interface FacetFilter<T> {
  id: string
  label: string
  options: { value: string; label: string }[]
  /** Return true when the row matches `value`. */
  predicate: (row: T, value: string) => boolean
  /** Initial value (e.g. from the URL). */
  defaultValue?: string
}

export interface BulkAction<T> {
  label: string
  icon?: ReactNode
  onClick: (rows: T[]) => void | Promise<void>
  variant?: 'default' | 'outline' | 'destructive'
  disabled?: (rows: T[]) => boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataColumn<T>[]
  getRowId: (row: T) => string
  /** Accessible table name. */
  caption: string
  searchPlaceholder?: string
  filters?: FacetFilter<T>[]
  onRowClick?: (row: T) => void
  selectable?: boolean
  bulkActions?: BulkAction<T>[]
  exportName?: string
  initialSort?: { id: string; desc?: boolean }
  pageSize?: number
  toolbar?: ReactNode
  emptyState?: ReactNode
  /** Extra row class, e.g. highlight overdue rows. */
  rowClassName?: (row: T) => string | undefined
  showFooter?: boolean
  dense?: boolean
}

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text, datetime: sortFn_datetime },
})

type Features = typeof features

/**
 * Standard data grid: search, faceted filters, sorting, pagination, column
 * visibility, row selection with bulk actions and CSV export of the filtered rows.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  caption,
  searchPlaceholder = 'Search…',
  filters = [],
  onRowClick,
  selectable,
  bulkActions = [],
  exportName,
  initialSort,
  pageSize = 15,
  toolbar,
  emptyState,
  rowClassName,
  showFooter,
  dense,
}: DataTableProps<T>) {
  const compact = usePreferences((s) => s.compactTables) || dense
  const [search, setSearch] = useState('')
  const [facetValues, setFacetValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.filter((f) => f.defaultValue).map((f) => [f.id, f.defaultValue!])),
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const active = filters.filter((f) => facetValues[f.id] && facetValues[f.id] !== 'all')
    if (!needle && !active.length) return data
    const searchCols = columns.filter((c) => c.searchable !== false)
    return data.filter((row) => {
      for (const f of active) if (!f.predicate(row, facetValues[f.id]!)) return false
      if (!needle) return true
      return searchCols.some((c) => {
        const v = c.accessor(row)
        return v !== null && v !== undefined && String(v).toLowerCase().includes(needle)
      })
    })
  }, [data, columns, filters, facetValues, search])

  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<Features, T>()
    const defs: ColumnDef<Features, T, unknown>[] = []
    if (selectable) {
      defs.push(
        helper.display({
          id: '__select',
          enableSorting: false,
          enableHiding: false,
          header: ({ table }) => (
            <Checkbox
              aria-label="Select all rows on this page"
              checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label="Select row"
              checked={row.getIsSelected()}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
            />
          ),
        }) as ColumnDef<Features, T, unknown>,
      )
    }
    for (const col of columns) {
      defs.push(
        helper.accessor((row: T) => col.accessor(row) ?? undefined, {
          id: col.id,
          header: col.header,
          enableSorting: col.sortable !== false,
          enableHiding: !col.alwaysVisible,
          sortUndefined: 'last',
          cell: ({ row }) => (col.cell ? col.cell(row.original) : formatPlain(col.accessor(row.original))),
        }) as ColumnDef<Features, T, unknown>,
      )
    }
    return defs
  }, [columns, selectable])

  const initialVisibility = useMemo(() => Object.fromEntries(columns.filter((c) => c.defaultHidden).map((c) => [c.id, false])), [columns])

  const table = useTable({
    features,
    columns: tableColumns,
    data: filtered,
    getRowId: (row: T) => getRowId(row),
    initialState: {
      sorting: initialSort ? [{ id: initialSort.id, desc: !!initialSort.desc }] : [],
      pagination: { pageIndex: 0, pageSize },
      columnVisibility: initialVisibility,
    },
  })

  // Reset to the first page when search/filters change.
  useEffect(() => {
    table.setPageIndex(0)
  }, [search, facetValues, table])

  // Drop selections for rows that no longer exist (e.g. after delete).
  const selectedIds = Object.keys(table.state.rowSelection ?? {}).filter((id) => table.state.rowSelection[id])
  const selectedRows = useMemo(() => {
    const ids = new Set(selectedIds)
    return data.filter((r) => ids.has(getRowId(r)))
  }, [data, getRowId, selectedIds.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const colById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const rows = table.getRowModel().rows
  const { pageIndex, pageSize: size } = table.state.pagination
  const total = filtered.length
  const from = total === 0 ? 0 : pageIndex * size + 1
  const to = Math.min(total, (pageIndex + 1) * size)
  const hasActiveFilter = !!search || Object.values(facetValues).some((v) => v && v !== 'all')

  const doExport = () => {
    const visible = table.getVisibleLeafColumns().map((c) => colById.get(c.id)).filter((c): c is DataColumn<T> => !!c && !c.noExport)
    const sortedRows = table.getSortedRowModel().rows.map((r) => r.original)
    exportCsv(timestampedName(exportName ?? 'export'), sortedRows, visible.map((c) => ({ header: c.header, value: (r: T) => (c.exportValue ?? c.accessor)(r) })))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" aria-label={`Search ${caption}`} />
          {search ? (
            <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2" aria-label="Clear search">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {filters.map((f) => (
          <Select key={f.id} value={facetValues[f.id] ?? 'all'} onValueChange={(v) => setFacetValues((s) => ({ ...s, [f.id]: v }))}>
            <SelectTrigger size="sm" className="h-9 w-auto min-w-36" aria-label={`Filter by ${f.label}`}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {hasActiveFilter ? (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFacetValues({}) }}>
            Reset
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 /> <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                    {colById.get(c.id)?.header ?? c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {exportName ? (
            <Button variant="outline" size="sm" className="h-9" onClick={doExport} disabled={!total}>
              <Download /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
          ) : null}
        </div>
      </div>

      {selectable && selectedRows.length > 0 ? (
        <div className="bg-accent/60 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm" role="status">
          <span className="font-medium">{selectedRows.length} selected</span>
          {bulkActions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.variant ?? 'outline'}
              disabled={a.disabled?.(selectedRows)}
              onClick={async () => {
                await a.onClick(selectedRows)
                table.resetRowSelection(true)
              }}
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => table.resetRowSelection(true)}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table aria-label={caption}>
          <caption className="sr-only">{caption}</caption>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const col = colById.get(header.column.id)
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn('text-muted-foreground h-10 text-xs font-medium', col?.align === 'right' && 'text-right', col?.align === 'center' && 'text-center', header.column.id === '__select' && 'w-10')}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('hover:text-foreground inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', col?.align === 'right' && 'flex-row-reverse')}
                        >
                          {col?.header}
                          {sorted === 'asc' ? <ArrowUp className="size-3.5" /> : sorted === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row.original))}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row.original)
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const col = colById.get(cell.column.id)
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(compact ? 'py-1.5' : 'py-2.5', col?.align === 'right' && 'tabular text-right', col?.align === 'center' && 'text-center', col?.className)}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-4">
                  {hasActiveFilter ? (
                    <EmptyState
                      icon={<SearchX />}
                      title="No matching records"
                      description="Try a different search term or clear the filters."
                      action={
                        <Button size="sm" variant="outline" onClick={() => { setSearch(''); setFacetValues({}) }}>
                          Clear filters
                        </Button>
                      }
                      className="border-0"
                    />
                  ) : (
                    (emptyState ?? <EmptyState title="Nothing here yet" description="Records you create will appear here." className="border-0" />)
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {showFooter && rows.length ? (
            <TableFooter>
              <TableRow>
                {table.getVisibleLeafColumns().map((c) => {
                  const col = colById.get(c.id)
                  return (
                    <TableCell key={c.id} className={cn('tabular font-semibold', col?.align === 'right' && 'text-right')}>
                      {col?.footer ?? null}
                    </TableCell>
                  )
                })}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span aria-live="polite">
          {total === 0 ? 'No records' : `Showing ${from}–${to} of ${total}`}
          {total !== data.length ? ` (filtered from ${data.length})` : ''}
        </span>
        <div className="flex items-center gap-1">
          <Select value={String(size)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger size="sm" className="h-8 w-[92px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 15, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">
            <ChevronsLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="px-1 tabular-nums">
            {table.getPageCount() ? pageIndex + 1 : 0} / {table.getPageCount()}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatPlain(v: unknown): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}
