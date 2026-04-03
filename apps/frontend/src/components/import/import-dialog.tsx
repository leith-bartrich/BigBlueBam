import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  Globe,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Dialog } from '@/components/common/dialog';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { api } from '@/lib/api';

type ImportSource = 'jira-csv' | 'trello-json' | 'generic-csv' | 'github-issues';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  [csvColumn: string]: string;
}

const SOURCES: { value: ImportSource; label: string; description: string; icon: typeof FileText }[] = [
  { value: 'jira-csv', label: 'Jira CSV', description: 'Export from Jira as CSV', icon: FileText },
  { value: 'trello-json', label: 'Trello JSON', description: 'Export from Trello as JSON', icon: FileText },
  { value: 'generic-csv', label: 'Generic CSV', description: 'Any CSV with task data', icon: FileText },
  { value: 'github-issues', label: 'GitHub Issues', description: 'Import from a GitHub repo', icon: Globe },
];

const TARGET_FIELDS = [
  { value: '', label: '-- Skip --' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'status', label: 'Status' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'story_points', label: 'Story Points' },
  { value: 'labels', label: 'Labels' },
  { value: 'type', label: 'Type' },
];

const JIRA_MAPPING: Record<string, string> = {
  Summary: 'title',
  Description: 'description',
  Priority: 'priority',
  Assignee: 'assignee',
  Status: 'status',
  'Due Date': 'due_date',
  'Story Points': 'story_points',
  Labels: 'labels',
  'Issue Type': 'type',
};

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser handling quoted fields
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]!);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]!);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export function ImportDialog({ open, onOpenChange, projectId }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [trelloData, setTrelloData] = useState<unknown>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep(1);
    setSource(null);
    setFile(null);
    setGithubUrl('');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setTrelloData(null);
    setImportResult(null);
    setDragOver(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const importCsv = useMutation({
    mutationFn: (data: { mapping: ColumnMapping; rows: CsvRow[] }) =>
      api.post<{ data: { imported: number; errors: number } }>(
        `/projects/${projectId}/import/csv`,
        data,
      ),
    onSuccess: (res) => {
      setImportResult(res.data);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const importTrello = useMutation({
    mutationFn: (data: unknown) =>
      api.post<{ data: { imported: number; errors: number } }>(
        `/projects/${projectId}/import/trello`,
        data,
      ),
    onSuccess: (res) => {
      setImportResult(res.data);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const importGithub = useMutation({
    mutationFn: (url: string) =>
      api.post<{ data: { imported: number; errors: number } }>(
        `/projects/${projectId}/import/github`,
        { url },
      ),
    onSuccess: (res) => {
      setImportResult(res.data);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const isImporting = importCsv.isPending || importTrello.isPending || importGithub.isPending;

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);

      if (source === 'trello-json') {
        try {
          const text = await selectedFile.text();
          const json = JSON.parse(text);
          setTrelloData(json);
          setStep(3);
        } catch {
          // Invalid JSON
        }
        return;
      }

      // CSV sources
      try {
        const text = await selectedFile.text();
        const { headers, rows } = parseCsv(text);
        setCsvHeaders(headers);
        setCsvRows(rows);

        // Auto-map for Jira
        if (source === 'jira-csv') {
          const mapping: ColumnMapping = {};
          headers.forEach((h) => {
            if (JIRA_MAPPING[h]) {
              mapping[h] = JIRA_MAPPING[h]!;
            }
          });
          setColumnMapping(mapping);
        } else {
          // Auto-map by name similarity
          const mapping: ColumnMapping = {};
          headers.forEach((h) => {
            const lower = h.toLowerCase();
            if (lower.includes('title') || lower === 'name' || lower === 'summary') mapping[h] = 'title';
            else if (lower.includes('description') || lower === 'body') mapping[h] = 'description';
            else if (lower.includes('priority')) mapping[h] = 'priority';
            else if (lower.includes('assignee') || lower === 'owner') mapping[h] = 'assignee';
            else if (lower.includes('status') || lower === 'state') mapping[h] = 'status';
            else if (lower.includes('due') || lower.includes('deadline')) mapping[h] = 'due_date';
            else if (lower.includes('point') || lower === 'estimate') mapping[h] = 'story_points';
            else if (lower.includes('label') || lower === 'tag' || lower === 'tags') mapping[h] = 'labels';
          });
          setColumnMapping(mapping);
        }

        setStep(3);
      } catch {
        // Parse error
      }
    },
    [source],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect],
  );

  const handleImport = () => {
    if (source === 'trello-json' && trelloData) {
      importTrello.mutate(trelloData);
    } else if (source === 'github-issues') {
      importGithub.mutate(githubUrl);
    } else {
      // CSV import
      importCsv.mutate({ mapping: columnMapping, rows: csvRows });
    }
  };

  const previewRows = csvRows.slice(0, 5);

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Import Tasks"
      description={`Step ${step} of 4`}
      className="max-w-2xl"
    >
      <div className="min-h-[300px]">
        {/* Step 1: Choose Source */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 mb-4">Choose your import source:</p>
            {SOURCES.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    setSource(s.value);
                    if (s.value === 'github-issues') {
                      setStep(2);
                    } else {
                      setStep(2);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                    source === s.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.label}</p>
                    <p className="text-xs text-zinc-500">{s.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-400 ml-auto" />
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Upload File or Paste URL */}
        {step === 2 && (
          <div className="space-y-4">
            {source === 'github-issues' ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                  Paste the GitHub repository URL to import issues from:
                </p>
                <Input
                  id="github-url"
                  label="Repository URL"
                  placeholder="https://github.com/owner/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    disabled={!githubUrl.trim()}
                    onClick={() => {
                      setStep(3);
                    }}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                  Upload your {source === 'trello-json' ? 'Trello JSON export' : 'CSV'} file:
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                      : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  <Upload className="h-8 w-8 text-zinc-400 mb-2" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {file ? file.name : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {source === 'trello-json' ? '.json' : '.csv'} files accepted
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={source === 'trello-json' ? '.json' : '.csv'}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview & Mapping */}
        {step === 3 && (
          <div className="space-y-4">
            {source === 'github-issues' ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                  Ready to import issues from: <span className="font-mono text-zinc-700 dark:text-zinc-300">{githubUrl}</span>
                </p>
                <p className="text-sm text-zinc-500">
                  Issues will be imported as tasks with their title, description, labels, and assignees.
                </p>
                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={handleImport} loading={isImporting}>
                    Import Issues
                  </Button>
                </div>
              </div>
            ) : source === 'trello-json' ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                  Trello board data loaded from <span className="font-mono">{file?.name}</span>.
                  Cards will be imported as tasks, with lists mapped to phases.
                </p>
                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={handleImport} loading={isImporting}>
                    Import from Trello
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                  Map CSV columns to task fields. Preview of first {previewRows.length} rows:
                </p>

                {/* Column mapping */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {csvHeaders.map((header) => (
                    <div key={header} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 w-40 truncate shrink-0" title={header}>
                        {header}
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                      <Select
                        options={TARGET_FIELDS}
                        value={columnMapping[header] ?? ''}
                        onValueChange={(val) =>
                          setColumnMapping((prev) => ({ ...prev, [header]: val }))
                        }
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>

                {/* Preview table */}
                {previewRows.length > 0 && (
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800">
                          {csvHeaders.slice(0, 5).map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            {csvHeaders.slice(0, 5).map((h) => (
                              <td key={h} className="px-3 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                                {row[h] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-zinc-400">
                  Total rows: {csvRows.length}
                </p>

                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    loading={isImporting}
                    disabled={!Object.values(columnMapping).some((v) => v === 'title')}
                  >
                    Import {csvRows.length} Tasks
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {importResult && importResult.errors === 0 ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Import Complete
                </h3>
                <p className="text-sm text-zinc-500">
                  Successfully imported {importResult.imported} tasks.
                </p>
              </>
            ) : importResult ? (
              <>
                <AlertCircle className="h-12 w-12 text-yellow-500" />
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Import Completed with Issues
                </h3>
                <p className="text-sm text-zinc-500">
                  Imported {importResult.imported} tasks. {importResult.errors} rows had errors.
                </p>
              </>
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            )}

            <Button onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
