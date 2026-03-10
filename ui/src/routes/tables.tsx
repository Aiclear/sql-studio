import React from "react";
import "react-data-grid/lib/styles.css";

import {
  HardDrive,
  DatabaseZap,
  TableProperties,
  Table as TableIcon,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { z } from "zod";
import { DataGrid, textEditor } from "react-data-grid";
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
import { fetchTable, fetchTableData, fetchTables, updateTableCell, insertTableRow } from "@/api";
import { InfoCard, InfoCardProps } from "@/components/info-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
function TableData({ name }: TableDataProps) {
  const currentTheme = useTheme();
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [editingRow, setEditingRow] = React.useState<Record<string, any> | null>(null);

  const { data } = useQuery({
    queryKey: ["tables", "data", name, page, pageSize],
    queryFn: () => fetchTableData(name, page, pageSize),
  });

  const updateMutation = useMutation({
    mutationFn: ({ rowId, columnName, value }: { rowId: number; columnName: string; value: any }) =>
      updateTableCell(name, rowId, columnName, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
    },
  });

  const insertMutation = useMutation({
    mutationFn: (rowData: Record<string, any>) => insertTableRow(name, rowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "data", name] });
      setEditingRow(null);
    },
  });

  if (!data) return <Skeleton className="h-[400px]" />;

  const columns = data.columns.map((col) => ({
    key: col,
    name: col,
    editable: true,
    editor: textEditor,
  }));

  const rows = data.rows.map((row, index) =>
    row.reduce((acc, curr, i) => {
      acc[data.columns[i]] = curr;
      acc.id = index;
      return acc;
    }, {} as Record<string, any>),
  );

  const handleRowsChange = (newRows: Record<string, any>[]) => {
    const changedRow = newRows.find((row, index) => {
      const originalRow = rows[index];
      return originalRow && JSON.stringify(row) !== JSON.stringify(originalRow);
    });

    if (changedRow) {
      const rowId = changedRow.rowid || changedRow.id;
      if (rowId !== undefined && rowId !== null && typeof rowId === 'number') {
        const originalRow = rows.find(r => (r.rowid || r.id) === rowId);
        if (originalRow) {
          for (const key of Object.keys(changedRow)) {
            if (changedRow[key] !== originalRow[key]) {
              updateMutation.mutate({ rowId, columnName: key, value: changedRow[key] });
              break;
            }
          }
        }
      }
    }
  };

  const handleAddRow = () => {
    const newRow: Record<string, any> = { id: "new" };
    data.columns.forEach((col) => {
      newRow[col] = "";
    });
    setEditingRow(newRow);
  };

  const handleCopyRow = (row: Record<string, any>) => {
    const copiedRow: Record<string, any> = { id: "new" };
    data.columns.forEach((col) => {
      if (col !== "rowid" && col !== "id") {
        copiedRow[col] = row[col] ?? "";
      }
    });
    setEditingRow(copiedRow);
  };

  const handleSaveNewRow = () => {
    if (editingRow) {
      const rowData = { ...editingRow };
      delete rowData.id;
      insertMutation.mutate(rowData);
    }
  };

  const allRows = editingRow ? [...rows, editingRow] : rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button onClick={handleAddRow} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
          {editingRow && (
            <Button onClick={handleSaveNewRow} size="sm" variant="default">
              Save New Row
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Page Size:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              size="sm"
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              onClick={() => setPage((p) => p + 1)}
              disabled={data.rows.length < pageSize}
              size="sm"
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DataGrid
        rows={allRows}
        columns={[
          ...columns,
          {
            key: "actions",
            name: "Actions",
            width: 100,
            renderCell: ({ row }) => (
              <div className="flex gap-1">
                {row.id !== "new" && (
                  <Button
                    onClick={() => handleCopyRow(row)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        onRowsChange={handleRowsChange}
        defaultColumnOptions={{ resizable: true }}
        className={cn(currentTheme === "light" ? "rdg-light" : "rdg-dark")}
        style={{ height: "500px" }}
      />
    </div>
  );
}
