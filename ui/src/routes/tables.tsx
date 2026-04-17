import "react-data-grid/lib/styles.css";

import {
  HardDrive,
  DatabaseZap,
  TableProperties,
  Table as TableIcon,
  Download,
  Plus,
  Trash2,
  Edit,
  Copy,
  Check,
  MoreHorizontal,
  FileJson,
} from "lucide-react";
import { z } from "zod";
import { DataGrid, SelectColumn } from "react-data-grid";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CodeBlock, irBlack as CodeDarkTheme } from "react-code-blocks";
import { useState, useMemo } from "react";

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
  fetchMetadata,
  fetchErd,
  fetchExecute,
} from "@/api";
import { InfoCard, InfoCardProps } from "@/components/info-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const { data: metadata } = useQuery({
    queryKey: ["metadata"],
    queryFn: () => fetchMetadata(),
  });

  const { data: erdData } = useQuery({
    queryKey: ["erd"],
    queryFn: () => fetchErd(),
  });

  const isPostgres = metadata?.db_type === "postgres";

  const tableColumns = useMemo(() => {
    if (!erdData) return [];
    const table = erdData.tables.find((t) => t.name === name);
    return table?.columns || [];
  }, [erdData, name]);

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
      <div className="flex items-center justify-between">
        <h2 className="px-2 text-foreground scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          {data.name}
        </h2>
        {isPostgres && (
          <div className="flex gap-2">
            <AlterTableDialog
              tableName={name}
              tableColumns={tableColumns}
            />
          </div>
        )}
      </div>

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
        <TableData
          name={data.name}
          isPostgres={isPostgres}
          tableColumns={tableColumns}
        />
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

function isAtBottom({ currentTarget }: React.UIEvent<HTMLDivElement>): boolean {
  return (
    currentTarget.scrollTop + 10 >=
    currentTarget.scrollHeight - currentTarget.clientHeight
  );
}

interface TableDataProps {
  name: string;
  isPostgres: boolean;
  tableColumns: Array<{
    name: string;
    data_type: string;
    nullable: boolean;
    is_primary_key: boolean;
  }>;
}

function TableData({ name, isPostgres, tableColumns }: TableDataProps) {
  const currentTheme = useTheme();
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<number>>(
    new Set()
  );
  const [sqlDialogOpen, setSqlDialogOpen] = useState(false);
  const [generatedSql, setGeneratedSql] = useState("");
  const [sqlDialogTitle, setSqlDialogTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const { isLoading, data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["tables", "data", name],
    queryFn: ({ pageParam }) => fetchTableData(name, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _, lastPageParams) => {
      if (lastPage.rows.length === 0) return undefined;
      return lastPageParams + 1;
    },
  });

  if (!data) return <Skeleton className="h-[400px]" />;

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (isLoading || !isAtBottom(event) || !hasNextPage) return;
    fetchNextPage();
  }

  const columns = data.pages[0].columns.map((col) => ({ key: col, name: col }));

  type RowData = Record<string, any>;

  const grouped = data.pages.map((page) =>
    page.rows.map((row) =>
      row.reduce((acc: RowData, curr, i) => {
        acc[page.columns[i]] = curr;
        return acc;
      }, {} as RowData),
    ),
  );
  const rows: RowData[] = ([] as RowData[]).concat(...grouped);

  const gridColumns = isPostgres
    ? [SelectColumn as any, ...columns]
    : columns;

  const handleGenerateInsert = () => {
    if (selectedRows.size === 0) return;

    const columnNames = columns.map((c) => c.name);
    const selectedIndices = Array.from(selectedRows);

    const sqlStatements = selectedIndices.map((idx) => {
      const row = rows[idx];
      if (!row) return "";

      const values = columnNames.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") {
          return `'${val.replace(/'/g, "''")}'`;
        }
        return String(val);
      });

      return `INSERT INTO "${name}" (${columnNames.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});`;
    });

    setGeneratedSql(sqlStatements.filter(Boolean).join("\n"));
    setSqlDialogTitle("Generated INSERT Statements");
    setSqlDialogOpen(true);
  };

  const handleGenerateDelete = () => {
    if (selectedRows.size === 0) return;

    const selectedIndices = Array.from(selectedRows);
    const pkColumn = tableColumns.find((c) => c.is_primary_key)?.name;

    const sqlStatements = selectedIndices.map((idx) => {
      const row = rows[idx];
      if (!row) return "";

      if (pkColumn && row[pkColumn] !== undefined) {
        const pkValue = row[pkColumn];
        const pkStr =
          typeof pkValue === "string"
            ? `'${pkValue.replace(/'/g, "''")}'`
            : String(pkValue);
        return `DELETE FROM "${name}" WHERE "${pkColumn}" = ${pkStr};`;
      }

      const conditions = columns.map((col) => {
        const val = row[col.name];
        if (val === null || val === undefined) {
          return `"${col.name}" IS NULL`;
        }
        if (typeof val === "string") {
          return `"${col.name}" = '${val.replace(/'/g, "''")}'`;
        }
        return `"${col.name}" = ${val}`;
      });

      return `DELETE FROM "${name}" WHERE ${conditions.join(" AND ")};`;
    });

    setGeneratedSql(sqlStatements.filter(Boolean).join("\n"));
    setSqlDialogTitle("Generated DELETE Statements");
    setSqlDialogOpen(true);
  };

  const handleExportCsv = () => {
    const columnNames = columns.map((c) => c.name);
    const header = columnNames.join(",");

    const csvRows = rows.map((row) => {
      return columnNames
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",");
    });

    const csvContent = [header, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {isPostgres && (
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateInsert}
              disabled={selectedRows.size === 0}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Generate INSERT ({selectedRows.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDelete}
              disabled={selectedRows.size === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Generate DELETE ({selectedRows.size})
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      )}

      <DataGrid
        rows={rows}
        columns={gridColumns as any}
        onScroll={handleScroll}
        defaultColumnOptions={{ resizable: true }}
        className={cn(currentTheme === "light" ? "rdg-light" : "rdg-dark")}
        selectedRows={selectedRows as any}
        onSelectedRowsChange={setSelectedRows as any}
        rowKeyGetter={(row) => {
          const idx = rows.indexOf(row);
          return idx >= 0 ? idx : Math.random();
        }}
      />

      <Dialog open={sqlDialogOpen} onOpenChange={setSqlDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{sqlDialogTitle}</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySql}
                className="h-8 px-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto">
            <CodeBlock
              text={generatedSql}
              language="sql"
              theme={currentTheme === "dark" ? CodeDarkTheme : undefined}
              showLineNumbers={true}
              customStyle={{
                FontFace: "JetBrains Mono",
                padding: "10px",
                backgroundColor:
                  currentTheme === "dark" ? "#091813" : "#f5faf9",
                borderRadius: "10px",
                maxHeight: "50vh",
                overflow: "auto",
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AlterTableDialogProps {
  tableName: string;
  tableColumns: Array<{
    name: string;
    data_type: string;
    nullable: boolean;
    is_primary_key: boolean;
  }>;
}

function AlterTableDialog({ tableName, tableColumns }: AlterTableDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"add" | "modify" | "drop">("add");
  const [generatedSql, setGeneratedSql] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const currentTheme = useTheme();

  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState("");
  const [newColumnNullable, setNewColumnNullable] = useState(true);
  const [newColumnDefault, setNewColumnDefault] = useState("");

  const [selectedColumnToModify, setSelectedColumnToModify] = useState("");
  const [modifyNewName, setModifyNewName] = useState("");
  const [modifyNewType, setModifyNewType] = useState("");
  const [modifyNullable, setModifyNullable] = useState<boolean | undefined>(
    undefined
  );

  const [selectedColumnToDrop, setSelectedColumnToDrop] = useState("");

  const postgresTypes = [
    "INTEGER",
    "BIGINT",
    "SMALLINT",
    "SERIAL",
    "BIGSERIAL",
    "DECIMAL",
    "NUMERIC",
    "REAL",
    "DOUBLE PRECISION",
    "MONEY",
    "CHAR",
    "VARCHAR",
    "VARCHAR(255)",
    "TEXT",
    "BYTEA",
    "DATE",
    "TIME",
    "TIMESTAMP",
    "TIMESTAMPTZ",
    "INTERVAL",
    "BOOLEAN",
    "POINT",
    "LINE",
    "LSEG",
    "BOX",
    "PATH",
    "POLYGON",
    "CIRCLE",
    "CIDR",
    "INET",
    "MACADDR",
    "UUID",
    "XML",
    "JSON",
    "JSONB",
    "ARRAY",
  ];

  const handleAddColumn = () => {
    if (!newColumnName || !newColumnType) return;

    let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${newColumnName}" ${newColumnType}`;
    if (!newColumnNullable) {
      sql += " NOT NULL";
    }
    if (newColumnDefault) {
      sql += ` DEFAULT ${newColumnDefault}`;
    }
    sql += ";";

    setGeneratedSql(sql);
    setShowResult(true);
  };

  const handleModifyColumn = () => {
    if (!selectedColumnToModify) return;

    const statements: string[] = [];

    if (modifyNewName && modifyNewName !== selectedColumnToModify) {
      statements.push(
        `ALTER TABLE "${tableName}" RENAME COLUMN "${selectedColumnToModify}" TO "${modifyNewName}";`
      );
    }

    const targetColumn = modifyNewName || selectedColumnToModify;

    if (modifyNewType) {
      statements.push(
        `ALTER TABLE "${tableName}" ALTER COLUMN "${targetColumn}" TYPE ${modifyNewType};`
      );
    }

    if (modifyNullable !== undefined) {
      if (modifyNullable) {
        statements.push(
          `ALTER TABLE "${tableName}" ALTER COLUMN "${targetColumn}" DROP NOT NULL;`
        );
      } else {
        statements.push(
          `ALTER TABLE "${tableName}" ALTER COLUMN "${targetColumn}" SET NOT NULL;`
        );
      }
    }

    if (statements.length > 0) {
      setGeneratedSql(statements.join("\n"));
      setShowResult(true);
    }
  };

  const handleDropColumn = () => {
    if (!selectedColumnToDrop) return;

    const sql = `ALTER TABLE "${tableName}" DROP COLUMN "${selectedColumnToDrop}";`;
    setGeneratedSql(sql);
    setShowResult(true);
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = async () => {
    if (!generatedSql) return;

    setIsExecuting(true);
    setExecuteResult(null);

    try {
      const result = await fetchExecute(generatedSql);
      if (result.success) {
        setExecuteResult({
          success: true,
          message: result.message || "Table structure modified successfully!",
        });
      } else {
        setExecuteResult({
          success: false,
          message: result.message || "Failed to execute SQL",
        });
      }
    } catch (error) {
      setExecuteResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const resetForm = () => {
    setNewColumnName("");
    setNewColumnType("");
    setNewColumnNullable(true);
    setNewColumnDefault("");
    setSelectedColumnToModify("");
    setModifyNewName("");
    setModifyNewType("");
    setModifyNullable(undefined);
    setSelectedColumnToDrop("");
    setShowResult(false);
    setGeneratedSql("");
    setExecuteResult(null);
    setIsExecuting(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Modify Table
            <MoreHorizontal className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => { setActiveTab("add"); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Column
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setActiveTab("modify"); setOpen(true); }}>
            <Edit className="h-4 w-4 mr-2" />
            Modify Column
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setActiveTab("drop"); setOpen(true); }}>
            <Trash2 className="h-4 w-4 mr-2" />
            Drop Column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Modify Table: {tableName}</DialogTitle>
          <DialogDescription>
            Generate ALTER TABLE statements to modify the table structure.
          </DialogDescription>
        </DialogHeader>

        {!showResult ? (
          <div className="space-y-4 flex-shrink-0 overflow-auto">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="add">Add Column</TabsTrigger>
                <TabsTrigger value="modify">Modify Column</TabsTrigger>
                <TabsTrigger value="drop">Drop Column</TabsTrigger>
              </TabsList>

              <TabsContent value="add" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-column-name">Column Name</Label>
                    <Input
                      id="new-column-name"
                      placeholder="e.g., new_column"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-column-type">Data Type</Label>
                    <Select
                      value={newColumnType}
                      onValueChange={setNewColumnType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {postgresTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-column-default">
                      Default Value (optional)
                    </Label>
                    <Input
                      id="new-column-default"
                      placeholder="e.g., 0 or 'default'"
                      value={newColumnDefault}
                      onChange={(e) => setNewColumnDefault(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nullable</Label>
                    <Select
                      value={newColumnNullable ? "true" : "false"}
                      onValueChange={(v) => setNewColumnNullable(v === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">NULL allowed</SelectItem>
                        <SelectItem value="false">NOT NULL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddColumn} className="w-full">
                  Generate ADD COLUMN SQL
                </Button>
              </TabsContent>

              <TabsContent value="modify" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="modify-column-select">Select Column</Label>
                  <Select
                    value={selectedColumnToModify}
                    onValueChange={(v) => {
                      setSelectedColumnToModify(v);
                      setModifyNewName(v);
                      const col = tableColumns.find((c) => c.name === v);
                      if (col) {
                        setModifyNewType(col.data_type);
                        setModifyNullable(col.nullable ? true : false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column to modify" />
                    </SelectTrigger>
                    <SelectContent>
                      {tableColumns.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name} ({col.data_type}
                          {col.is_primary_key && " PK"}
                          {!col.nullable && " NOT NULL"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedColumnToModify && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="modify-new-name">New Name</Label>
                        <Input
                          id="modify-new-name"
                          value={modifyNewName}
                          onChange={(e) => setModifyNewName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="modify-new-type">New Data Type</Label>
                        <Select
                          value={modifyNewType}
                          onValueChange={setModifyNewType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {postgresTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nullable</Label>
                      <Select
                        value={
                          modifyNullable === undefined
                            ? ""
                            : modifyNullable
                              ? "true"
                              : "false"
                        }
                        onValueChange={(v) =>
                          setModifyNullable(v === "true" ? true : false)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">NULL allowed</SelectItem>
                          <SelectItem value="false">NOT NULL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleModifyColumn} className="w-full">
                      Generate ALTER COLUMN SQL
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="drop" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="drop-column-select">
                    Select Column to Drop
                  </Label>
                  <Select
                    value={selectedColumnToDrop}
                    onValueChange={setSelectedColumnToDrop}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column to drop" />
                    </SelectTrigger>
                    <SelectContent>
                      {tableColumns
                        .filter((c) => !c.is_primary_key)
                        .map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name} ({col.data_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedColumnToDrop && (
                  <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive">
                    <Trash2 className="h-4 w-4 inline mr-2" />
                    Warning: Dropping a column will permanently delete all
                    data in that column. This action cannot be undone.
                  </div>
                )}

                <Button
                  onClick={handleDropColumn}
                  variant="destructive"
                  className="w-full"
                  disabled={!selectedColumnToDrop}
                >
                  Generate DROP COLUMN SQL
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Generated SQL</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySql}
                className="h-8 px-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto mb-4">
              <CodeBlock
                text={generatedSql}
                language="sql"
                theme={currentTheme === "dark" ? CodeDarkTheme : undefined}
                showLineNumbers={true}
                customStyle={{
                  FontFace: "JetBrains Mono",
                  padding: "10px",
                  backgroundColor:
                    currentTheme === "dark" ? "#091813" : "#f5faf9",
                  borderRadius: "10px",
                  minHeight: "150px",
                }}
              />
            </div>

            {executeResult && (
              <div
                className={`p-3 rounded-lg mb-4 text-sm ${
                  executeResult.success
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {executeResult.success ? (
                  <Check className="h-4 w-4 inline mr-2" />
                ) : null}
                {executeResult.message}
              </div>
            )}

            <DialogFooter className="flex gap-2 flex-shrink-0">
              <Button variant="outline" onClick={resetForm}>
                Back
              </Button>
              <Button
                onClick={handleExecute}
                disabled={isExecuting || !!executeResult?.success}
              >
                {isExecuting ? "Executing..." : "Execute"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
