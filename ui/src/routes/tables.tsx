import "react-data-grid/lib/styles.css";

import {
  HardDrive,
  DatabaseZap,
  TableProperties,
  Table as TableIcon,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { z } from "zod";
import {
  DataGrid,
  Column,
  RowsChangeData,
  RenderEditCellProps,
  RenderCellProps,
} from "react-data-grid";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CodeBlock, irBlack as CodeDarkTheme } from "react-code-blocks";

import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/provider/theme.provider";
import {
  fetchTable,
  fetchTableData,
  fetchTables,
  fetchPrimaryKeys,
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
        <EditableTableData name={data.name} rowCount={data.row_count} />
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

interface DataRow {
  id: number;
  [key: string]: unknown;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type TableDataProps = {
  name: string;
  rowCount: number;
};

function EditableTableData({ name, rowCount }: TableDataProps) {
  const currentTheme = useTheme();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [copiedRowData, setCopiedRowData] = useState<Record<string, unknown> | null>(null);

  const totalPages = Math.ceil(rowCount / pageSize);

  const { data: primaryKeysData } = useQuery({
    queryKey: ["tables", "primary-keys", name],
    queryFn: () => fetchPrimaryKeys(name),
  });

  const { data } = useQuery({
    queryKey: ["tables", "data", name, page, pageSize],
    queryFn: () => fetchTableData(name, page, pageSize),
  });

  const primaryKeyColumns = useMemo(() => {
    if (!primaryKeysData) return [] as string[];
    return primaryKeysData.keys;
  }, [primaryKeysData]);

  const updateMutation = useMutation({
    mutationFn: (params: {
      primaryKeys: Record<string, unknown>;
      row: Record<string, unknown>;
    }) => updateRow(name, params.primaryKeys, params.row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name], type: "all" });
    },
  });

  const insertMutation = useMutation({
    mutationFn: (row: Record<string, unknown>) => insertRow(name, row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name], type: "all" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setEditingRow(null);
      setCopiedRowData(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (primaryKeys: Record<string, unknown>) =>
      deleteRow(name, primaryKeys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name], type: "all" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });

  const rows = useMemo(() => {
    if (!data) return [] as DataRow[];
    const result: DataRow[] = data.rows.map((row, idx) => {
      const obj: DataRow = { id: idx };
      data.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    if (editingRow !== null && editingRow >= result.length) {
      const newRow: DataRow = { id: editingRow };
      data.columns.forEach((col) => {
        if (copiedRowData && copiedRowData[col] !== undefined) {
          newRow[col] = copiedRowData[col];
        } else {
          newRow[col] = "";
        }
      });
      result.push(newRow);
    }

    return result;
  }, [data, editingRow, copiedRowData]);

  const getRowPrimaryKeys = useCallback(
    (row: DataRow): Record<string, unknown> => {
      const keys: Record<string, unknown> = {};
      primaryKeyColumns.forEach((col) => {
        keys[col] = row[col];
      });
      return keys;
    },
    [primaryKeyColumns],
  );

  const handleCopyRow = useCallback(
    (rowIndex: number) => {
      if (!data) return;
      if (rowIndex < 0 || rowIndex >= rows.length) return;
      const sourceRow = rows[rowIndex];
      const newRowData: Record<string, unknown> = {};
      Object.keys(sourceRow)
        .filter((k) => k !== "id")
        .forEach((k) => {
          if (!primaryKeyColumns.includes(k)) {
            newRowData[k] = sourceRow[k];
          }
        });
      setCopiedRowData(newRowData);
      setEditingRow(data.rows.length);
    },
    [data, rows, primaryKeyColumns],
  );

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      if (rowIndex < 0 || rowIndex >= rows.length) return;
      const row = rows[rowIndex];
      const primaryKeys = getRowPrimaryKeys(row);
      deleteMutation.mutate(primaryKeys);
    },
    [rows, getRowPrimaryKeys, deleteMutation],
  );

  const columns: Column<DataRow, unknown>[] = useMemo(() => {
    if (!data) return [];
    const actionColumn: Column<DataRow, unknown> = {
      key: "__actions__",
      name: "Actions",
      width: 80,
      frozen: true,
      resizable: false,
      renderCell: (props: RenderCellProps<DataRow>) => {
        const rowIdx = rows.findIndex((r) => r.id === props.row.id);
        if (rowIdx < 0 || rowIdx >= data.rows.length) return null;
        return (
          <div className="flex items-center gap-1 h-full">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => handleCopyRow(rowIdx)}
              title="Copy this row"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => handleDeleteRow(rowIdx)}
              title="Delete this row"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    };
    const dataColumns = data.columns.map((col) => ({
      key: col,
      name: col,
      editable: true,
      resizable: true,
      renderEditCell: (props: RenderEditCellProps<DataRow>) => (
        <input
          autoFocus
          className="w-full h-full bg-transparent px-1 outline-none"
          value={props.row[props.column.key] as string}
          onChange={(e) =>
            props.onRowChange({
              ...props.row,
              [props.column.key]: e.target.value,
            })
          }
          onBlur={() => props.onClose(true)}
        />
      ),
    }));
    return [actionColumn, ...dataColumns];
  }, [data, rows, handleCopyRow, handleDeleteRow]);

  const handleRowsChange = useCallback(
    (newRows: readonly DataRow[], details: RowsChangeData<DataRow>) => {
      const rowIndex = details.indexes[0];
      const column = details.column.key;
      const newRow = newRows[rowIndex];
      const oldRow = rows[rowIndex];

      if (rowIndex < rows.length) {
        const changes: Record<string, unknown> = {};
        changes[column] = newRow[column];

        const primaryKeys = getRowPrimaryKeys(oldRow);
        updateMutation.mutate({ primaryKeys, row: changes });
      } else {
        const newRowData: Record<string, unknown> = {};
        Object.keys(newRow)
          .filter((k) => k !== "id")
          .forEach((k) => {
            const value = newRow[k];
            if (value !== "" && value !== null && value !== undefined) {
              newRowData[k] = value;
            }
          });
        if (Object.keys(newRowData).length > 0) {
          insertMutation.mutate(newRowData);
        }
        setCopiedRowData(null);
      }
    },
    [rows, getRowPrimaryKeys, updateMutation, insertMutation],
  );

  const handleAddRow = () => {
    if (data) {
      setCopiedRowData(null);
      setEditingRow(data.rows.length);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    setPage(1);
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  if (!data) return <Skeleton className="h-[400px]" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleAddRow} variant="default">
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({rowCount.toLocaleString()} rows)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="w-20 h-8">
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
          <div className="flex items-center gap-1 ml-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => goToPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => goToPage(totalPages)}
              disabled={page === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={rows}
        onRowsChange={handleRowsChange}
        defaultColumnOptions={{ resizable: true }}
        className={cn(currentTheme === "light" ? "rdg-light" : "rdg-dark")}
        rowKeyGetter={(row) => row.id}
      />
    </div>
  );
}
