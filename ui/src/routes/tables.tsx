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
} from "lucide-react";
import { z } from "zod";
import { DataGrid, textEditor } from "react-data-grid";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { CodeBlock, irBlack as CodeDarkTheme } from "react-code-blocks";
import { useState, useCallback, useMemo } from "react";

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
  fetchTableColumns,
  insertRow,
  updateRow,
  deleteRow,
} from "@/api";
import { InfoCard, InfoCardProps } from "@/components/info-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type Row = Record<string, unknown>;
type NewRow = { id: string; isNew: true; data: Row };

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type TableDataProps = {
  name: string;
};

function TableData({ name }: TableDataProps) {
  const currentTheme = useTheme();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [newRows, setNewRows] = useState<NewRow[]>([]);

  const { data: columnsData } = useQuery({
    queryKey: ["tables", "columns", name],
    queryFn: () => fetchTableColumns(name),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tables", "data", name, page, pageSize],
    queryFn: () => fetchTableData(name, page, pageSize),
  });

  const insertMutation = useMutation({
    mutationFn: (row: Row) => insertRow(name, row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      queryClient.invalidateQueries({ queryKey: ["tables", name] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      primaryKey,
      keyValue,
      row,
    }: {
      primaryKey: string;
      keyValue: unknown;
      row: Row;
    }) => updateRow(name, primaryKey, keyValue, row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      primaryKey,
      keyValue,
    }: {
      primaryKey: string;
      keyValue: unknown;
    }) => deleteRow(name, primaryKey, keyValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      queryClient.invalidateQueries({ queryKey: ["tables", name] });
    },
  });

  const primaryKey = columnsData?.primary_key;
  const columns = useMemo(() => {
    if (!data) return [];
    return data.columns.map((col) => ({
      key: col,
      name: col,
      renderEditCell: textEditor,
    }));
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row, rowIndex) => {
      const rowData: Row = {};
      data.columns.forEach((col, i) => {
        rowData[col] = row[i];
      });
      const rowId = primaryKey ? String(rowData[primaryKey]) : String(rowIndex);
      return { id: rowId, ...rowData };
    });
  }, [data, primaryKey]);

  const allRows = useMemo(() => {
    const newRowsData = newRows.map((nr) => ({ id: nr.id, isNew: true, ...nr.data }));
    return [...newRowsData, ...rows] as (Row & { id?: string; isNew?: boolean })[];
  }, [rows, newRows]);

  const totalPages = data ? Math.ceil(data.total_rows / pageSize) : 0;

  const handleAddRow = useCallback(() => {
    const newRow: NewRow = {
      id: `new-${Date.now()}`,
      isNew: true,
      data: columnsData?.columns.reduce((acc, col) => {
        acc[col.name] = null;
        return acc;
      }, {} as Row) || {},
    };
    setNewRows((prev) => [...prev, newRow]);
  }, [columnsData]);

  const handleCopyRow = useCallback((row: Row) => {
    const data: Row = {};
    Object.keys(row).forEach((key) => {
      if (key !== "id" && key !== "isNew") {
        data[key] = row[key];
      }
    });
    if (primaryKey && data[primaryKey]) {
      data[primaryKey] = null;
    }
    const copiedRow: NewRow = {
      id: `copy-${Date.now()}`,
      isNew: true,
      data,
    };
    setNewRows((prev) => [...prev, copiedRow]);
  }, [primaryKey]);

  const handleDeleteRow = useCallback((row: Row) => {
    if (!primaryKey) {
      alert("Cannot delete row: no primary key defined");
      return;
    }
    const keyValue = row[primaryKey];
    if (keyValue === undefined || keyValue === null) {
      alert("Cannot delete row: primary key value is missing");
      return;
    }
    if (confirm(`Are you sure you want to delete this row?`)) {
      deleteMutation.mutate({ primaryKey, keyValue });
    }
  }, [primaryKey, deleteMutation]);

  const handleSaveNewRow = useCallback((newRow: NewRow) => {
    const rowToInsert: Row = {};
    Object.keys(newRow.data).forEach((key) => {
      if (key === "id" || key === "isNew") return;
      const value = newRow.data[key];
      if (value !== null && value !== undefined && value !== "") {
        rowToInsert[key] = value;
      }
    });
    insertMutation.mutate(rowToInsert, {
      onSuccess: () => {
        setNewRows((prev) => prev.filter((nr) => nr.id !== newRow.id));
      },
      onError: (error) => {
        alert(`Failed to insert row: ${error}`);
      },
    });
  }, [insertMutation]);

  const handleCancelNewRow = useCallback((rowId: string) => {
    setNewRows((prev) => prev.filter((nr) => nr.id !== rowId));
  }, []);

  const handleRowUpdate = useCallback((row: Row) => {
    if (!primaryKey) {
      alert("Cannot update row: no primary key defined");
      return;
    }
    const keyValue = row[primaryKey];
    const rowToUpdate: Row = {};
    Object.keys(row).forEach((key) => {
      if (key === "id" || key === "isNew") return;
      rowToUpdate[key] = row[key];
    });
    updateMutation.mutate({ primaryKey, keyValue, row: rowToUpdate });
  }, [primaryKey, updateMutation]);

  const onRowsChange = useCallback((newRows: typeof allRows, { indexes }: { indexes: number[] }) => {
    indexes.forEach((index) => {
      const changedRow = newRows[index];
      if (changedRow.isNew) {
        const rowData: Row = {};
        Object.keys(changedRow).forEach((key) => {
          if (key !== "id" && key !== "isNew") {
            rowData[key] = changedRow[key as keyof typeof changedRow];
          }
        });
        setNewRows((prev) =>
          prev.map((nr) =>
            nr.id === changedRow.id ? { ...nr, data: rowData } : nr
          )
        );
      } else if (primaryKey && changedRow[primaryKey]) {
        const rowData: Row = {};
        Object.keys(changedRow).forEach((key) => {
          if (key !== "id" && key !== "isNew") {
            rowData[key] = changedRow[key as keyof typeof changedRow];
          }
        });
        handleRowUpdate(rowData);
      }
    });
  }, [primaryKey, handleRowUpdate]);

  const actionColumn = useMemo(() => ({
    key: "__actions",
    name: "Actions",
    width: 150,
    renderCell: ({ row }: { row: Row & { id?: string; isNew?: boolean } }) => {
      if (row.isNew) {
        const newRow = newRows.find((nr) => nr.id === row.id);
        if (!newRow) return null;
        return (
          <div className="flex gap-1 p-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSaveNewRow(newRow)}
              disabled={insertMutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCancelNewRow(newRow.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      }
      return (
        <div className="flex gap-1 p-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCopyRow(row)}
            title="Copy row"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteRow(row)}
            disabled={deleteMutation.isPending}
            title="Delete row"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  }), [newRows, handleSaveNewRow, handleCancelNewRow, handleCopyRow, handleDeleteRow, insertMutation.isPending, deleteMutation.isPending]);

  const allColumns = useMemo(() => [...columns, actionColumn], [columns, actionColumn]);

  if (isLoading || !data) return <Skeleton className="h-[400px]" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
          <span className="text-sm text-muted-foreground">
            {data.total_rows.toLocaleString()} total rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataGrid
        rows={allRows}
        columns={allColumns}
        onRowsChange={onRowsChange}
        defaultColumnOptions={{ resizable: true }}
        className={cn(currentTheme === "light" ? "rdg-light" : "rdg-dark")}
        style={{ height: "calc(100vh - 400px)", minHeight: "300px" }}
      />

      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {page} of {totalPages} ({((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, data.total_rows)} of {data.total_rows})
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
