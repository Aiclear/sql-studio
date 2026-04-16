import "react-data-grid/lib/styles.css";

import { useState, useCallback, useMemo } from "react";
import {
  HardDrive,
  DatabaseZap,
  TableProperties,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Plus,
  Copy,
  Trash2,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";
import { DataGrid, type Column, SelectColumn } from "react-data-grid";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CodeBlock, irBlack as CodeDarkTheme } from "react-code-blocks";

import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/provider/theme.provider";
import {
  fetchTable,
  fetchTableData,
  fetchTables,
  fetchTableColumnsInfo,
  updateTableRow,
  insertTableRow,
  deleteTableRow,
} from "@/api";
import { InfoCard, InfoCardProps } from "@/components/info-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface RowData {
  [key: string]: unknown;
  __id: number;
}

type TableDataProps = {
  name: string;
};
function TableData({ name }: TableDataProps) {
  const currentTheme = useTheme();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    columnKey: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const { data: tableInfo } = useQuery({
    queryKey: ["tables", "columns", name],
    queryFn: () => fetchTableColumnsInfo(name),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tables", "data", name, page, pageSize],
    queryFn: () => fetchTableData(name, page, pageSize),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      primaryKeyValues,
      updates,
    }: {
      primaryKeyValues: Record<string, unknown>;
      updates: Record<string, unknown>;
    }) => updateTableRow(name, primaryKeyValues, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
    },
  });

  const insertMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => insertTableRow(name, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (primaryKeyValues: Record<string, unknown>) =>
      deleteTableRow(name, primaryKeyValues),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      setSelectedRows(new Set());
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row, idx) => {
      const rowData: RowData = { __id: idx };
      data.columns.forEach((col, i) => {
        rowData[col] = row[i];
      });
      return rowData;
    });
  }, [data]);

  const primaryKeys = useMemo(() => {
    return tableInfo?.primary_keys || [];
  }, [tableInfo]);

  const getPrimaryKeyValues = useCallback(
    (row: RowData): Record<string, unknown> => {
      const values: Record<string, unknown> = {};
      for (const pk of primaryKeys) {
        values[pk] = row[pk];
      }
      if (primaryKeys.length === 0) {
        const firstColumn = Object.keys(row).find((k) => k !== "__id");
        if (firstColumn) {
          values[firstColumn] = row[firstColumn];
        }
      }
      return values;
    },
    [primaryKeys],
  );

  const handleDoubleClick = useCallback(
    (rowIdx: number, columnKey: string) => {
      const row = rows[rowIdx];
      if (!row) return;
      setEditingCell({ rowIdx, columnKey });
      const value = row[columnKey];
      setEditValue(
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value),
      );
    },
    [rows],
  );

  const handleSaveEdit = useCallback(() => {
    if (!editingCell) return;
    const row = rows[editingCell.rowIdx];
    if (!row) {
      setEditingCell(null);
      return;
    }

    const primaryKeyValues = getPrimaryKeyValues(row);
    let parsedValue: unknown = editValue;
    if (editValue === "") {
      parsedValue = null;
    } else if (editValue === "null") {
      parsedValue = null;
    } else if (editValue === "true") {
      parsedValue = true;
    } else if (editValue === "false") {
      parsedValue = false;
    } else if (!isNaN(Number(editValue)) && editValue !== "") {
      parsedValue = Number(editValue);
    }

    updateMutation.mutate({
      primaryKeyValues,
      updates: { [editingCell.columnKey]: parsedValue },
    });

    setEditingCell(null);
  }, [editingCell, rows, editValue, getPrimaryKeyValues, updateMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCopySelected = useCallback(() => {
    if (selectedRows.size === 0) return;
    setShowCopyDialog(true);
  }, [selectedRows]);

  const confirmCopy = useCallback(() => {
    for (const rowIdx of selectedRows) {
      const row = rows[rowIdx];
      if (!row) continue;
      const values: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key !== "__id") {
          values[key] = value;
        }
      }
      insertMutation.mutate(values);
    }
    setShowCopyDialog(false);
    setSelectedRows(new Set());
  }, [selectedRows, rows, insertMutation]);

  const handleDeleteSelected = useCallback(() => {
    for (const rowIdx of selectedRows) {
      const row = rows[rowIdx];
      if (!row) continue;
      const primaryKeyValues = getPrimaryKeyValues(row);
      deleteMutation.mutate(primaryKeyValues);
    }
  }, [selectedRows, rows, getPrimaryKeyValues, deleteMutation]);

  const columns: Column<RowData>[] = useMemo(() => {
    if (!data) return [];
    const dataColumns = data.columns.map((col) => ({
      key: col,
      name: col,
      resizable: true,
      editable: true,
      renderCell: ({
        row,
        column,
        rowIdx,
      }: {
        row: RowData;
        column: Column<RowData>;
        rowIdx: number;
      }) => {
        const isEditing =
          editingCell?.rowIdx === rowIdx &&
          editingCell?.columnKey === column.key;

        if (isEditing) {
          return (
            <div className="flex items-center gap-1 w-full">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveEdit();
                  } else if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                className="h-7 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleSaveEdit}
              >
                <Check className="h-4 w-4 text-green-500" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        }

        const value = row[column.key];
        const displayValue =
          value === null || value === undefined
            ? "NULL"
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);

        return (
          <div
            className="w-full h-full flex items-center cursor-pointer hover:bg-accent/50 px-1"
            onDoubleClick={() => handleDoubleClick(rowIdx, column.key)}
            title="Double-click to edit"
          >
            {displayValue === "NULL" ? (
              <span className="text-muted-foreground italic">{displayValue}</span>
            ) : (
              displayValue
            )}
          </div>
        );
      },
    }));
    return [SelectColumn, ...dataColumns];
  }, [data, editingCell, editValue, handleDoubleClick, handleSaveEdit, handleCancelEdit]);

  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage >= 1) {
        setPage(newPage);
      }
    },
    [],
  );

  if (!data) return <Skeleton className="h-[400px]" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const emptyRow: Record<string, unknown> = {};
              for (const col of data.columns) {
                emptyRow[col] = null;
              }
              insertMutation.mutate(emptyRow);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopySelected}
            disabled={selectedRows.size === 0}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy ({selectedRows.size})
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={handleDeleteSelected}
            disabled={selectedRows.size === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete ({selectedRows.size})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="Page Size" />
            </SelectTrigger>
            <SelectContent>
              {[50, 100, 200, 500].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => goToPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 min-w-[60px] text-center">
              Page {page}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => goToPage(page + 1)}
              disabled={data.rows.length < pageSize}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DataGrid
        rows={rows}
        columns={columns}
        defaultColumnOptions={{ resizable: true }}
        className={cn(currentTheme === "light" ? "rdg-light" : "rdg-dark")}
        rowKeyGetter={(row) => row.__id}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
        enableVirtualization
        style={{ height: "500px" }}
      />

      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Selected Rows</DialogTitle>
            <DialogDescription>
              Are you sure you want to create copies of the{" "}
              {selectedRows.size} selected row(s)?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Confirm Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
