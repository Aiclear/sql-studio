import "react-data-grid/lib/styles.css";

import {
  HardDrive,
  DatabaseZap,
  TableProperties,
  Table as TableIcon,
  Plus,
  Copy,
  Trash2,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { z } from "zod";
import { DataGrid, textEditor } from "react-data-grid";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CodeBlock, irBlack as CodeDarkTheme } from "react-code-blocks";
import { useState, useMemo, useCallback } from "react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/provider/theme.provider";
import {
  fetchTable,
  fetchTableData,
  fetchTables,
  fetchPrimaryKey,
  updateRow,
  insertRow,
  deleteRow,
} from "@/api";
import { InfoCard, InfoCardProps } from "@/components/info-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/tables")({
  component: Tables,
  loader: () => fetchTables(),
  pendingComponent: TablesSkeleton,
  validateSearch: z.object({ table: z.string().optional() }),
});

function Tables() {
  const data = Route.useLoaderData();
  const { table } = Route.useSearch();

  if (data.tables.length === 0)
    return (
      <Card>
        <CardHeader className="flex items-center">
          <TableIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle>No Tables Found</CardTitle>
          <CardDescription>The database has no tables.</CardDescription>
        </CardHeader>
      </Card>
    );

  const requestedTableIndex = table
    ? data.tables.findIndex(({ name }) => name === table)
    : -1;

  const requestedTableMissing = !!table && requestedTableIndex < 0;
  const tab = String(Math.max(requestedTableIndex, 0));

  return (
    <>
      {requestedTableMissing && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle>Table not found</CardTitle>
            <CardDescription>
              Could not find "{table}". Showing the first available table
              instead.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Tabs key={tab} defaultValue={tab}>
        <TabsList>
          {data.tables.map((n, i) => (
            <TabsTrigger key={i} value={i.toString()}>
              <Link to="/tables" search={{ table: n.name }}>
                {n.name} [{n.count.toLocaleString()}]
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
        {data.tables.map(({ name }, i) => (
          <TabsContent key={i} value={i.toString()} className="py-4">
            <Table name={name} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function TablesSkeleton() {
  return <Skeleton className="w-[70vw] h-[30px]" />;
}

type Props = {
  name: string;
};
function Table({ name }: Props) {
  const currentTheme = useTheme();
  const { data } = useQuery({
    queryKey: ["tables", name],
    queryFn: () => fetchTable(name),
  });

  if (!data) return <TableSkeleton />;

  const cards: InfoCardProps[] = [
    {
      title: "ROW COUNT",
      value: data.row_count.toLocaleString(),
      description: "The number of rows in the table.",
      icon: TableIcon,
    },
    {
      title: "INDEXES",
      value: data.index_count.toLocaleString(),
      description: "The number of indexes in the table.",
      icon: DatabaseZap,
    },
    {
      title: "COLUMNS",
      value: data.column_count.toLocaleString(),
      description: "The number of columns in the table.",
      icon: TableProperties,
    },
    {
      title: "TABLE SIZE",
      value: data.table_size,
      description: "The size of the table on disk.",
      icon: HardDrive,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <h2 className="px-2 text-foreground scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        {data.name}
      </h2>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        {cards.map((card, i) => (
          <InfoCard
            key={i}
            title={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
          />
        ))}
      </div>

      {data.sql && (
        <Card className="font-mono text-sm">
          <CodeBlock
            text={data.sql}
            language="sql"
            theme={currentTheme === "dark" ? CodeDarkTheme : undefined}
            showLineNumbers={false}
            customStyle={{
              FontFace: "JetBrains Mono",
              padding: "10px",
              backgroundColor: currentTheme === "dark" ? "#091813" : "#f5faf9",
              borderRadius: "10px",
            }}
          />
        </Card>
      )}

      <Card className="p-2">
        <TableData name={data.name} />
      </Card>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="w-[50vw] h-[50px]" />
        <span className="border-b" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-[100px]" />
      </div>

      <Skeleton className="h-[400px]" />
      <Skeleton className="h-[400px]" />
    </div>
  );
}

type TableDataProps = {
  name: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

// Generate a unique key for a row based on primary key value
function getRowKey(row: Record<string, unknown>, primaryKey: string | null | undefined): string {
  if (primaryKey && row[primaryKey] !== undefined) {
    return String(row[primaryKey]);
  }
  // Fallback: use JSON stringification of the row
  return JSON.stringify(row);
}

function TableData({ name }: TableDataProps) {
  const currentTheme = useTheme();
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, unknown>>({});
  const [editedRows, setEditedRows] = useState<Map<string, Record<string, unknown>>>(new Map());

  const { data: primaryKey } = useQuery({
    queryKey: ["tables", "primaryKey", name],
    queryFn: () => fetchPrimaryKey(name),
  });

  // Fetch table data with pagination
  const { isLoading, data, refetch } = useQuery({
    queryKey: ["tables", "data", name, currentPage, pageSize],
    queryFn: () => fetchTableData(name, currentPage, pageSize),
  });

  const updateRowMutation = useMutation({
    mutationFn: ({
      primaryKey: pk,
      rowData,
    }: {
      primaryKey: { column: string; value: unknown };
      rowData: Record<string, unknown>;
    }) => updateRow(name, pk, rowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      setEditedRows(new Map());
    },
  });

  const insertRowMutation = useMutation({
    mutationFn: (rowData: Record<string, unknown>) => insertRow(name, rowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      setIsAddingRow(false);
      setNewRowData({});
      refetch();
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: (pk: { column: string; value: unknown }) =>
      deleteRow(name, pk),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      setSelectedRowKey(null);
      refetch();
    },
  });

  // Memoize rows and columns
  const { rows, columns, totalPages } = useMemo(() => {
    if (!data) return { rows: [], columns: [], totalPages: 0 };

    const cols = data.columns.map((col) => ({
      key: col,
      name: col,
      editable: true,
      editor: textEditor,
    }));

    const processedRows = data.rows.map((row) =>
      row.reduce((acc, curr, i) => {
        acc[data.columns[i]] = curr;
        return acc;
      }, {} as Record<string, unknown>)
    );

    const total = Math.ceil(data.row_count / pageSize);

    return { rows: processedRows, columns: cols, totalPages: total };
  }, [data, pageSize]);

  // Merge edited rows with original rows
  const displayRows = useMemo(() => {
    return rows.map((row) => {
      const rowKey = getRowKey(row, primaryKey);
      const editedRow = editedRows.get(rowKey);
      return editedRow ? { ...row, ...editedRow } : row;
    });
  }, [rows, editedRows, primaryKey]);

  // Get selected row
  const selectedRow = useMemo(() => {
    if (!selectedRowKey) return null;
    return rows.find((row) => getRowKey(row, primaryKey) === selectedRowKey) || null;
  }, [selectedRowKey, rows, primaryKey]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = editedRows.size > 0;

  if (!data) return <Skeleton className="h-[400px]" />;

  // Handle cell click for row selection
  const handleCellClick = (args: { row: Record<string, unknown> }) => {
    const rowKey = getRowKey(args.row, primaryKey);
    setSelectedRowKey(rowKey);
  };

  // Handle cell edit using DataGrid's onRowsChange
  const handleRowsChange = useCallback((newRows: Record<string, unknown>[], data: { indexes: number[]; column: { key: string } }) => {
    const rowIndex = data.indexes[0];
    const columnKey = data.column.key;
    const newValue = newRows[rowIndex][columnKey];
    
    const originalRow = rows[rowIndex];
    const rowKey = getRowKey(originalRow, primaryKey);
    
    setEditedRows((prev) => {
      const newMap = new Map(prev);
      const existingEdit = newMap.get(rowKey) || {};
      newMap.set(rowKey, { ...existingEdit, [columnKey]: newValue });
      return newMap;
    });
  }, [rows, primaryKey]);

  // Save edited rows
  const handleSaveChanges = () => {
    if (!primaryKey) return;

    editedRows.forEach((editedData, rowKey) => {
      const originalRow = rows.find((r) => getRowKey(r, primaryKey) === rowKey);
      if (originalRow) {
        const pkValue = originalRow[primaryKey];
        updateRowMutation.mutate({
          primaryKey: { column: primaryKey, value: pkValue },
          rowData: editedData,
        });
      }
    });
  };

  // Cancel edits
  const handleCancelChanges = () => {
    setEditedRows(new Map());
  };

  // Add new row
  const handleAddRow = () => {
    setIsAddingRow(true);
    setNewRowData(
      columns.reduce((acc, col) => {
        acc[col.key] = "";
        return acc;
      }, {} as Record<string, unknown>)
    );
  };

  // Copy selected row
  const handleCopyRow = () => {
    if (!selectedRow) return;
    setIsAddingRow(true);
    const copiedData = { ...selectedRow };
    // Remove primary key from copied data
    if (primaryKey) {
      delete copiedData[primaryKey];
    }
    setNewRowData(copiedData);
  };

  // Save new row
  const handleSaveNewRow = () => {
    insertRowMutation.mutate(newRowData);
  };

  // Cancel new row
  const handleCancelNewRow = () => {
    setIsAddingRow(false);
    setNewRowData({});
  };

  // Delete selected row
  const handleDeleteRow = () => {
    if (!selectedRow || !primaryKey) return;
    const pkValue = selectedRow[primaryKey];
    deleteRowMutation.mutate({ column: primaryKey, value: pkValue });
  };

  // Handle new row data change
  const handleNewRowChange = (column: string, value: string) => {
    setNewRowData((prev) => ({ ...prev, [column]: value }));
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  // Row class for styling
  const getRowClass = (row: Record<string, unknown>) => {
    const rowKey = getRowKey(row, primaryKey);
    const isEdited = editedRows.has(rowKey);
    return cn(
      "cursor-pointer",
      selectedRowKey === rowKey && "bg-primary/10",
      isEdited && "bg-yellow-50 dark:bg-yellow-950"
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Page Size:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Row count info */}
          <span className="text-sm text-muted-foreground">
            Total: {data.row_count.toLocaleString()} rows
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isAddingRow && !hasUnsavedChanges && (
            <>
              <Button variant="outline" size="sm" onClick={handleAddRow}>
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyRow}
                disabled={!selectedRow}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Row
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteRow}
                disabled={!selectedRow || !primaryKey}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
          {hasUnsavedChanges && (
            <>
              <Button variant="default" size="sm" onClick={handleSaveChanges}>
                <Save className="h-4 w-4 mr-1" />
                Save Changes ({editedRows.size})
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelChanges}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          )}
          {isAddingRow && (
            <>
              <Button variant="default" size="sm" onClick={handleSaveNewRow}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelNewRow}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* New Row Form */}
      {isAddingRow && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">New Row</h3>
          <div className="grid grid-cols-4 gap-3">
            {columns.map((col) => (
              <div key={col.key} className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{col.name}</label>
                <Input
                  value={String(newRowData[col.key] ?? "")}
                  onChange={(e) => handleNewRowChange(col.key, e.target.value)}
                  className="h-8"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Data Grid */}
      <DataGrid
        rows={displayRows}
        columns={columns}
        onRowsChange={handleRowsChange}
        onCellClick={handleCellClick}
        rowClass={getRowClass}
        defaultColumnOptions={{ resizable: true }}
        className={cn(
          currentTheme === "light" ? "rdg-light" : "rdg-dark",
          "h-[500px]"
        )}
      />

      {isLoading && (
        <div className="text-center text-sm text-muted-foreground py-2">
          Loading...
        </div>
      )}
    </div>
  );
}
