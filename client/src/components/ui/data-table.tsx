import * as React from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export interface Column<T> {
    header: string | React.ReactNode
    accessorKey?: keyof T
    cell?: (row: T) => React.ReactNode
    className?: string
    sortable?: boolean
}

interface DataTableProps<T> {
    columns: Column<T>[]
    data: T[]
    searchKey?: keyof T
    pageSize?: number

    // Server-side pagination props
    manualPagination?: boolean
    totalRows?: number
    onPageChange?: (page: number, limit: number) => void

    // Toggle props
    enablePaginationToggle?: boolean
    isPaginationEnabled?: boolean
    onPaginationToggle?: (enabled: boolean) => void
}

export function DataTable<T extends { id?: string | number }>({
    columns,
    data,
    searchKey,
    pageSize = 10,
    manualPagination = false,
    totalRows = 0,
    onPageChange,
    enablePaginationToggle = false,
    isPaginationEnabled = true,
    onPaginationToggle
}: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = React.useState(1)
    const [itemsPerPage, setItemsPerPage] = React.useState(pageSize)
    const [sortConfig, setSortConfig] = React.useState<{ key: keyof T, direction: 'asc' | 'desc' } | null>(null)
    const [searchTerm, setSearchTerm] = React.useState("")

    // Filter
    // If manualPagination is true, we assume data is already filtered/paginated by parent/API.
    // However, if we are in "Show All" mode (manualPagination false but large list), we might want client-side filter.
    const filteredData = React.useMemo(() => {
        if (manualPagination) return data;
        if (!searchTerm || !searchKey) return data
        const lower = searchTerm.toLowerCase()
        return data.filter(item => {
            const val = item[searchKey]
            if (val === null || val === undefined) return false
            return String(val).toLowerCase().includes(lower)
        })
    }, [data, searchTerm, searchKey, manualPagination])

    // Sort
    const sortedData = React.useMemo(() => {
        if (manualPagination) return filteredData;
        if (!sortConfig) return filteredData
        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key]
            const bVal = b[sortConfig.key]

            if (aVal === bVal) return 0
            if (aVal === null || aVal === undefined) return 1
            if (bVal === null || bVal === undefined) return -1

            const compare = aVal < bVal ? -1 : 1
            return sortConfig.direction === 'asc' ? compare : -compare
        })
    }, [filteredData, sortConfig, manualPagination])

    // Pagination
    const effectiveTotalRows = manualPagination ? totalRows : sortedData.length;
    // If manual, uses provided count. If client-side, uses filtered/sorted length.

    const effectiveItemsPerPage = isPaginationEnabled ? itemsPerPage : effectiveTotalRows;
    const totalPages = (effectiveItemsPerPage > 0) ? Math.ceil(effectiveTotalRows / effectiveItemsPerPage) : 1;

    const paginatedData = React.useMemo(() => {
        if (!isPaginationEnabled) return sortedData;
        if (manualPagination) return sortedData; // Parent provided correct slice

        const start = (currentPage - 1) * itemsPerPage
        return sortedData.slice(start, start + itemsPerPage)
    }, [sortedData, currentPage, itemsPerPage, isPaginationEnabled, manualPagination])

    // Handler for page change
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        if (manualPagination && onPageChange) {
            onPageChange(newPage, itemsPerPage);
        }
    };

    // Handler for size change
    const handleLimitChange = (newLimit: number) => {
        setItemsPerPage(newLimit);
        setCurrentPage(1);
        if (manualPagination && onPageChange) {
            onPageChange(1, newLimit);
        }
    };

    // Reset page on filter/sort change (Client-side only)
    React.useEffect(() => {
        if (!manualPagination) setCurrentPage(1)
    }, [searchTerm, sortConfig, manualPagination])

    const handleSort = (key: keyof T) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key, direction: 'asc' }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                {searchKey && (
                    <div className="flex items-center">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                )}

                {enablePaginationToggle && onPaginationToggle && (
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="pagination-mode"
                            checked={isPaginationEnabled}
                            onCheckedChange={onPaginationToggle}
                        />
                        <Label htmlFor="pagination-mode">Paginated View</Label>
                    </div>
                )}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col, idx) => (
                                <TableHead key={idx} className={col.className}>
                                    {col.sortable && col.accessorKey ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort(col.accessorKey!)}
                                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                                        >
                                            <span>{col.header}</span>
                                            {sortConfig?.key === col.accessorKey ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ChevronsUpDown className="ml-2 h-4 w-4" />
                                            )}
                                        </Button>
                                    ) : (
                                        col.header
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length ? (
                            paginatedData.map((row, rIdx) => (
                                <TableRow key={row.id || rIdx}>
                                    {columns.map((col, cIdx) => (
                                        <TableCell key={cIdx} className={col.className}>
                                            {col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey] ?? "") : null)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {isPaginationEnabled && (
                <div className="flex items-center justify-end space-x-2">
                    {(effectiveTotalRows > itemsPerPage || itemsPerPage !== pageSize) && (
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">Rows per page</p>
                            <Select
                                value={`${itemsPerPage}`}
                                onValueChange={(value) => handleLimitChange(Number(value))}
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={pageSize} />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 30, 50, 100].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center justify-end space-x-2">
                        <div className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
