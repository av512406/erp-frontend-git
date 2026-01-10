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
    searchKey?: keyof T // Key to filter by (string comparison)
    pageSize?: number
}

export function DataTable<T extends { id?: string | number }>({ columns, data, searchKey, pageSize = 10 }: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = React.useState(1)
    const [sortConfig, setSortConfig] = React.useState<{ key: keyof T, direction: 'asc' | 'desc' } | null>(null)
    const [searchTerm, setSearchTerm] = React.useState("")

    // Filter
    const filteredData = React.useMemo(() => {
        if (!searchTerm || !searchKey) return data
        const lower = searchTerm.toLowerCase()
        return data.filter(item => {
            const val = item[searchKey]
            if (val === null || val === undefined) return false
            return String(val).toLowerCase().includes(lower)
        })
    }, [data, searchTerm, searchKey])

    // Sort
    const sortedData = React.useMemo(() => {
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
    }, [filteredData, sortConfig])

    // Pagination
    const totalPages = Math.ceil(sortedData.length / pageSize)
    const paginatedData = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedData.slice(start, start + pageSize)
    }, [sortedData, currentPage, pageSize])

    // Reset page on filter/sort change
    React.useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, sortConfig])

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

            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2">
                    <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
