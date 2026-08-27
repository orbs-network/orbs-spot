"use client";

import {
  Children,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  BracesIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClipboardIcon,
  Code2Icon,
  LockIcon,
  Maximize2Icon,
  Minimize2Icon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import {
  Highlight,
  themes,
  type Language,
} from "prism-react-renderer";
import { allExpanded, JsonView } from "react-json-view-lite";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/ui/form-label";
import { InlineMessage } from "@/components/ui/inline-message";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SegmentedTabs } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeveloperMode } from "./use-developer-mode";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonContainer = JsonValue[] | { [key: string]: JsonValue };
export type JsonValuePath = Array<string | number>;

export type JsonValidationIssue = {
  message: string;
  path?: string;
};

export type CurlOptions = {
  headers?: Record<string, string>;
  includeBody?: boolean;
  method?: string;
  url?: string;
};

export type CodeSnippetFileOptions = {
  fieldPathAliases?: Record<string, JsonValuePath>;
  format: (data: JsonContainer) => string;
  getFallbackFieldExplanation?: (
    path: JsonValuePath,
    value: JsonValue,
  ) => string | undefined;
  hiddenFieldTooltipDescendantKeys?: string[];
  name: string;
  showFieldTooltips?: boolean;
  syntaxLanguage?: Language;
};

export type CodeSnippetOptions = {
  copyLabel?: string;
  fileName?: string;
  files?: CodeSnippetFileOptions[];
  format: (data: JsonContainer) => string;
  getFieldExplanation?: (
    path: JsonValuePath,
    value: JsonValue,
  ) => string | undefined;
  hideStatusLabel?: boolean;
  inlineEditable?: boolean;
  language?: string;
  syntaxLanguage?: Language;
};

export type JsonInspectorModalProps = {
  codeSnippet?: CodeSnippetOptions;
  codeScrollResetKey?: string | number;
  codeSnippetState?: "active" | "review";
  copyActionsInHeaders?: boolean;
  copyAs?: "curl" | "json";
  curl?: CurlOptions;
  data: JsonContainer;
  defaultOpen?: boolean;
  density?: "default" | "documentation";
  description?: string;
  editable?: boolean;
  explanation?: string;
  explanationDisplay?: "subtitle" | "tooltip";
  getFieldExplanation?: (path: JsonValuePath, value: JsonValue) => string | undefined;
  getResponseFieldExplanation?: (
    path: JsonValuePath,
    value: JsonValue,
  ) => string | undefined;
  headerBackAction?: {
    ariaLabel?: string;
    onClick: () => void;
  };
  headerNotice?: ReactNode;
  isValueEditable?: (path: JsonValuePath, value: JsonPrimitive) => boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (data: JsonContainer) => Promise<void> | void;
  open?: boolean;
  requiresDeveloperMode?: boolean;
  requestResponseTabs?: boolean;
  resetData?: JsonContainer;
  tabsInSectionHeader?: boolean;
  responseData?: JsonContainer;
  responseInitiallyCollapsed?: boolean;
  responseLabel?: string;
  responseNotice?: ReactNode;
  title?: string;
  trigger?: ReactElement | null;
  triggerLabel?: string;
  triggerTooltip?: string;
  validate?: (data: JsonContainer) => JsonValidationIssue[];
  viewModeAction?: ReactNode;
};

export type JsonInspectorPanelProps = Omit<
  JsonInspectorModalProps,
  | "defaultOpen"
  | "onOpenChange"
  | "open"
  | "requiresDeveloperMode"
  | "trigger"
  | "triggerLabel"
  | "triggerTooltip"
>;

type JsonInspectorContentProps = JsonInspectorModalProps & {
  embedded?: boolean;
};

type EditorMode = "view" | "edit";
type PreviewTab = "request" | "response";
type FieldInputs = Record<string, string>;
type FieldErrors = Record<string, string>;

const jsonViewStyles: ComponentProps<typeof JsonView>["style"] = {
  basicChildStyle: "leading-6",
  booleanValue: "text-primary",
  childFieldsContainer: "m-0 pl-4 sm:pl-5",
  clickableLabel: "cursor-pointer hover:text-primary",
  collapseIcon:
    "mr-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground",
  collapsedContent: "mr-1 text-muted-foreground",
  container:
    "font-mono text-[13px] leading-6 text-foreground [overflow-wrap:anywhere]",
  expandIcon:
    "mr-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground",
  label: "mr-1 font-semibold text-foreground",
  nullValue: "italic text-muted-foreground",
  numberValue: "text-chart-3",
  otherValue: "text-chart-4",
  punctuation: "text-muted-foreground",
  quotesForFieldNames: false,
  stringValue: "text-chart-2",
  stringifyStringValues: true,
  undefinedValue: "italic text-muted-foreground",
};

const REQUEST_RESPONSE_TAB_OPTIONS = [
  { label: "Request", value: "request" },
  { label: "Response", value: "response" },
] as const;

const getEntries = (data: JsonContainer): Array<[string, JsonValue]> =>
  Array.isArray(data)
    ? data.map((value, index) => [String(index), value])
    : Object.entries(data);

const isJsonContainer = (value: JsonValue): value is JsonContainer =>
  value !== null && typeof value === "object";

const formatPath = (path: JsonValuePath) =>
  path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : result
          ? `${result}.${segment}`
          : segment,
    "",
  );

function ExplainedJsonView({
  ariaLabel,
  data,
  getFieldExplanation,
  initiallyCollapsed = false,
}: {
  ariaLabel: string;
  data: JsonContainer;
  getFieldExplanation: NonNullable<
    JsonInspectorModalProps["getFieldExplanation"]
  >;
  initiallyCollapsed?: boolean;
}) {
  const [toggledPaths, setToggledPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const togglePath = (path: JsonValuePath) => {
    const pathKey = formatPath(path);

    setToggledPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      if (nextPaths.has(pathKey)) {
        nextPaths.delete(pathKey);
      } else {
        nextPaths.add(pathKey);
      }
      return nextPaths;
    });
  };

  const renderPrimitive = (value: JsonPrimitive) => {
    if (value === null) {
      return <span className="italic text-muted-foreground">null</span>;
    }
    if (typeof value === "boolean") {
      return <span className="text-primary">{String(value)}</span>;
    }
    if (typeof value === "number") {
      return <span className="text-chart-3">{String(value)}</span>;
    }

    return <span className="text-chart-2">{JSON.stringify(value)}</span>;
  };

  const renderEntries = (
    container: JsonContainer,
    parentPath: JsonValuePath,
  ): ReactNode => {
    const entries = getEntries(container);

    return entries.map(([key, value], index) => {
      const parentIsArray = Array.isArray(container);
      const pathSegment = parentIsArray ? Number(key) : key;
      const path = [...parentPath, pathSegment];
      const isLast = index === entries.length - 1;
      const trailingComma = isLast ? "" : ",";

      if (isJsonContainer(value)) {
        const pathKey = formatPath(path);
        const explanation = getFieldExplanation(path, value);
        const hasChildren = getEntries(value).length > 0;
        const isExpanded =
          hasChildren &&
          (initiallyCollapsed
            ? toggledPaths.has(pathKey)
            : !toggledPaths.has(pathKey));
        const openingPunctuation = Array.isArray(value) ? "[" : "{";
        const closingPunctuation = Array.isArray(value) ? "]" : "}";
        const keyNode = hasChildren ? (
          <button
            type="button"
            onClick={() => togglePath(path)}
            className={`rounded-sm font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
              explanation
                ? "cursor-help border-b border-dashed border-muted-foreground/70 hover:border-foreground focus-visible:border-primary"
                : ""
            }`}
          >
            {key}
          </button>
        ) : (
          <span
            tabIndex={explanation ? 0 : undefined}
            className={`font-semibold text-foreground outline-none ${
              explanation
                ? "cursor-help border-b border-dashed border-muted-foreground/70 hover:border-foreground focus-visible:border-primary"
                : ""
            }`}
          >
            {key}
          </span>
        );

        return (
          <div
            key={pathKey}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected="false"
          >
            <div className="leading-6">
              {hasChildren && (
                <button
                  type="button"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${pathKey}`}
                  aria-expanded={isExpanded}
                  onClick={() => togglePath(path)}
                  className="mr-1 inline-flex size-5 items-center justify-center rounded align-middle text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  {isExpanded ? (
                    <ChevronDownIcon aria-hidden="true" className="size-3.5" />
                  ) : (
                    <ChevronRightIcon aria-hidden="true" className="size-3.5" />
                  )}
                </button>
              )}
              {!parentIsArray && (
                <>
                  {explanation ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{keyNode}</TooltipTrigger>
                      <TooltipContent>{explanation}</TooltipContent>
                    </Tooltip>
                  ) : (
                    keyNode
                  )}
                  <span className="text-muted-foreground">: </span>
                </>
              )}
              <span className="text-muted-foreground">
                {openingPunctuation}
              </span>
              {!isExpanded && hasChildren && (
                <span className="text-muted-foreground">…</span>
              )}
              {!isExpanded && (
                <span className="text-muted-foreground">
                  {closingPunctuation}
                  {trailingComma}
                </span>
              )}
            </div>
            {isExpanded && (
              <>
                <div role="group" className="pl-4 sm:pl-5">
                  {renderEntries(value, path)}
                </div>
                <div className="leading-6 text-muted-foreground">
                  {closingPunctuation}
                  {trailingComma}
                </div>
              </>
            )}
          </div>
        );
      }

      const explanation = getFieldExplanation(path, value);

      return (
        <div
          key={formatPath(path)}
          role="treeitem"
          aria-selected="false"
          className="leading-6"
        >
          {!parentIsArray && (
            <>
              {explanation ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="cursor-help border-b border-dashed border-muted-foreground/70 font-semibold text-foreground outline-none hover:border-foreground focus-visible:border-primary"
                      aria-label={`Explain ${formatPath(path)}`}
                    >
                      {key}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{explanation}</TooltipContent>
                </Tooltip>
              ) : (
                <span className="font-semibold text-foreground">{key}</span>
              )}
              <span className="text-muted-foreground">: </span>
            </>
          )}
          {renderPrimitive(value)}
          <span className="text-muted-foreground">{trailingComma}</span>
        </div>
      );
    });
  };

  return (
    <div
      role="tree"
      aria-label={ariaLabel}
      className="font-mono text-[13px] leading-6 text-foreground [overflow-wrap:anywhere]"
    >
      {renderEntries(data, [])}
    </div>
  );
}

const updateValueAtPath = (
  data: JsonContainer,
  path: JsonValuePath,
  value: JsonValue,
): JsonContainer => {
  const update = (current: JsonValue, pathIndex: number): JsonValue => {
    const segment = path[pathIndex];
    const isLastSegment = pathIndex === path.length - 1;

    if (Array.isArray(current)) {
      const nextValue = [...current];
      const index = Number(segment);
      nextValue[index] = isLastSegment
        ? value
        : update(nextValue[index], pathIndex + 1);
      return nextValue;
    }
    if (current !== null && typeof current === "object") {
      const nextValue = { ...current };
      const key = String(segment);
      nextValue[key] = isLastSegment
        ? value
        : update(nextValue[key], pathIndex + 1);
      return nextValue;
    }

    return current;
  };

  return update(data, 0) as JsonContainer;
};

const getValueAtPath = (
  data: JsonContainer,
  path: JsonValuePath,
): JsonValue | undefined =>
  path.reduce<JsonValue | undefined>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (current !== null && typeof current === "object") {
      return current[String(segment)];
    }
    return undefined;
  }, data);

type JsonLineAnnotation = {
  path: JsonValuePath;
  value: JsonPrimitive;
};

const buildCodeLineAnnotations = (
  code: string,
  data: JsonContainer,
) => {
  const annotations = new Map<number, JsonLineAnnotation>();
  const contexts: Array<{
    indent: number;
    path: JsonValuePath;
  }> = [];
  const lines = code.split("\n");

  lines.forEach((line, lineIndex) => {
    const propertyMatch = line.match(
      /^(\s*)(?:"([^"]+)"|([A-Za-z_$][\w$]*)):\s*(.*)$/,
    );
    if (!propertyMatch) return;

    const indent = propertyMatch[1].length;
    const key = propertyMatch[2] ?? propertyMatch[3];
    const serializedValue = propertyMatch[4].replace(/,$/, "").trim();
    while (
      contexts.length &&
      contexts[contexts.length - 1].indent >= indent
    ) {
      contexts.pop();
    }

    const path = [
      ...(contexts.at(-1)?.path ?? []),
      key,
    ];

    const value = getValueAtPath(data, path);
    if (value === undefined) return;

    if (serializedValue === "{" || serializedValue === "[") {
      contexts.push({
        indent,
        path,
      });
      return;
    }

    if (!isJsonContainer(value)) {
      annotations.set(lineIndex, { path, value });
    }
  });

  return annotations;
};

const formatFieldInput = (value: JsonValue) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const createFieldInputs = (data: JsonContainer): FieldInputs => {
  const inputs: FieldInputs = {};

  const visit = (value: JsonValue, path: JsonValuePath) => {
    if (isJsonContainer(value)) {
      getEntries(value).forEach(([key, childValue]) => {
        visit(childValue, [
          ...path,
          Array.isArray(value) ? Number(key) : key,
        ]);
      });
      return;
    }

    inputs[formatPath(path)] = formatFieldInput(value);
  };

  visit(data, []);
  return inputs;
};

const getValueType = (value: JsonValue) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const formatFieldLabel = (key: string, isArray: boolean) => {
  if (isArray) return `Item ${Number(key) + 1}`;

  const label = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();

  return label ? `${label[0].toUpperCase()}${label.slice(1)}` : key;
};

const getJsonParseError = (error: unknown) =>
  error instanceof Error ? error.message : "Enter valid JSON.";

const parseFieldInput = (
  input: string,
  originalValue: JsonValue,
): { error?: string; value?: JsonValue } => {
  if (typeof originalValue === "string") return { value: input };

  if (typeof originalValue === "number") {
    const value = Number(input);
    return input.trim() && Number.isFinite(value)
      ? { value }
      : { error: "Enter a valid number." };
  }

  try {
    return { value: JSON.parse(input) as JsonValue };
  } catch (error) {
    return { error: getJsonParseError(error) };
  }
};

const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

export const buildCurlCommand = (
  data: JsonContainer,
  options: CurlOptions = {},
) => {
  const method = (options.method ?? "POST").toUpperCase();
  const url =
    options.url ??
    (typeof window === "undefined" ? "/" : window.location.href);
  const includeBody =
    options.includeBody ?? !["GET", "HEAD"].includes(method);
  const headers = includeBody
    ? { "Content-Type": "application/json", ...options.headers }
    : options.headers;
  const parts = [
    `curl --request ${method}`,
    `--url ${shellQuote(url)}`,
    ...Object.entries(headers ?? {}).map(
      ([name, value]) => `--header ${shellQuote(`${name}: ${value}`)}`,
    ),
  ];

  if (includeBody) {
    parts.push(`--data-raw ${shellQuote(JSON.stringify(data))}`);
  }

  return parts.join(" \\\n  ");
};

function InspectorRoot({
  children,
  defaultOpen,
  embedded,
  onOpenChange,
  open,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  embedded: boolean;
  onOpenChange: (open: boolean) => void;
  open?: boolean;
}) {
  if (embedded) return <>{children}</>;

  return (
    <Dialog
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </Dialog>
  );
}

function InspectorContent({
  children,
  descriptionId,
  embedded,
  hasDescription,
}: {
  children: ReactNode;
  descriptionId: string;
  embedded: boolean;
  hasDescription: boolean;
}) {
  const ariaDescription = hasDescription ? descriptionId : undefined;

  if (embedded) {
    return (
      <div
        aria-describedby={ariaDescription}
        className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-card"
      >
        {children}
      </div>
    );
  }

  return (
    <DialogContent
      presentation="center"
      mobilePresentation="fullscreen"
      aria-describedby={ariaDescription}
      className="h-[min(1040px,98dvh)] max-w-[960px] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[22px] bg-card p-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:rounded-none max-sm:border-0"
    >
      {children}
    </DialogContent>
  );
}

function JsonInspectorModalContent({
  codeSnippet,
  codeScrollResetKey,
  codeSnippetState,
  copyActionsInHeaders = true,
  copyAs = "curl",
  curl,
  data,
  defaultOpen,
  density = "default",
  description,
  editable = false,
  embedded = false,
  explanation,
  explanationDisplay = "tooltip",
  getFieldExplanation: providedFieldExplanation,
  getResponseFieldExplanation,
  headerBackAction,
  headerNotice,
  isValueEditable,
  onOpenChange,
  onSave,
  open,
  requestResponseTabs = false,
  resetData,
  tabsInSectionHeader = false,
  responseData,
  responseInitiallyCollapsed = false,
  responseLabel = "JSON response",
  responseNotice,
  title = "JSON payload",
  trigger,
  triggerLabel = "View JSON",
  triggerTooltip,
  validate,
  viewModeAction,
}: JsonInspectorContentProps) {
  const descriptionId = useId();
  const fieldIdPrefix = useId();
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useRef<HTMLPreElement>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mode, setMode] = useState<EditorMode>("view");
  const [draft, setDraft] = useState<JsonContainer>(data);
  const [fieldInputs, setFieldInputs] = useState<FieldInputs>(() =>
    createFieldInputs(data),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCodeFullscreen, setIsCodeFullscreen] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("request");
  const [codeFileSelection, setCodeFileSelection] = useState<{
    codeSnippet?: CodeSnippetOptions;
    index: number;
  }>({ codeSnippet, index: 0 });
  const [copiedTarget, setCopiedTarget] = useState<
    "curl" | "primary" | "response"
  >();
  const resolvedDescription =
    description ??
    (codeSnippet
      ? "Inspect the populated code snippet or edit its input data."
      : "Inspect the JSON payload, validate changes, or copy the request as cURL.");
  const resolvedExplanation =
    explanation ??
    (codeSnippet
      ? "This view shows runnable code generated from the complete input data. Edit a field to regenerate the snippet."
      : "This view shows the complete JSON payload. Select an object or array label to collapse or expand its fields.");
  const getFieldExplanation =
    providedFieldExplanation ?? codeSnippet?.getFieldExplanation;
  const headerSubtitle =
    explanationDisplay === "subtitle"
      ? resolvedExplanation
      : resolvedDescription;
  const isDocumentationDensity = density === "documentation";
  const codeFiles = useMemo<CodeSnippetFileOptions[]>(
    () =>
      codeSnippet
        ? [
            {
              format: codeSnippet.format,
              name:
                codeSnippet.fileName ?? codeSnippet.language ?? "Code",
              syntaxLanguage:
                codeSnippet.syntaxLanguage ?? ("typescript" as Language),
            },
            ...(codeSnippet.files ?? []),
          ]
        : [],
    [codeSnippet],
  );
  const activeCodeFileIndex =
    codeFileSelection.codeSnippet === codeSnippet
      ? codeFileSelection.index
      : 0;
  const activeCodeFile =
    codeFiles[activeCodeFileIndex] ?? codeFiles[0];
  const formattedCode = useMemo(
    () => activeCodeFile?.format(draft),
    [activeCodeFile, draft],
  );
  const isMainCodeFile = activeCodeFileIndex === 0;
  const responseFieldExplanation =
    getResponseFieldExplanation ?? getFieldExplanation;
  const hasResponseContent =
    responseData !== undefined || responseNotice !== undefined;
  const previewCopyTarget =
    previewTab === "request" ? "primary" : "response";
  const inlineCodeFields = useMemo(() => {
    if (
      !formattedCode ||
      !codeSnippet?.inlineEditable ||
      !isMainCodeFile
    ) {
      return new Map<number, JsonLineAnnotation>();
    }

    return buildCodeLineAnnotations(formattedCode, data);
  }, [codeSnippet?.inlineEditable, data, formattedCode, isMainCodeFile]);
  const codeLineExplanations = useMemo(() => {
    const explanations = new Map<
      number,
      { key: string; path: string; tooltip: string }
    >();
    if (
      !formattedCode ||
      !getFieldExplanation ||
      activeCodeFile?.showFieldTooltips === false
    ) {
      return explanations;
    }

    const sectionStack: Array<{
      indent: number;
      nextArrayIndex?: number;
      path: JsonValuePath;
    }> = [];

    formattedCode.split("\n").forEach((line, lineIndex) => {
      const assignmentMatch = line.match(
        /^(\s*)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/,
      );
      if (assignmentMatch) {
        const indent = assignmentMatch[1].length;
        const key = assignmentMatch[2];
        const path = activeCodeFile?.fieldPathAliases?.[key] ?? [key];
        const value = getValueAtPath(draft, path);

        while (
          sectionStack.length &&
          sectionStack[sectionStack.length - 1].indent >= indent
        ) {
          sectionStack.pop();
        }

        if (value !== undefined && isJsonContainer(value)) {
          sectionStack.push({
            indent,
            nextArrayIndex: Array.isArray(value) ? 0 : undefined,
            path,
          });
        }
        return;
      }

      const arrayItemMatch = line.match(/^(\s*)\{\s*$/);
      if (arrayItemMatch) {
        const indent = arrayItemMatch[1].length;
        while (
          sectionStack.length &&
          sectionStack[sectionStack.length - 1].indent >= indent
        ) {
          sectionStack.pop();
        }

        const parent = sectionStack.at(-1);
        const parentValue = parent
          ? getValueAtPath(draft, parent.path)
          : undefined;
        if (!parent || !Array.isArray(parentValue)) return;

        const itemIndex = parent.nextArrayIndex ?? 0;
        const itemValue = parentValue[itemIndex];
        parent.nextArrayIndex = itemIndex + 1;
        if (itemValue !== undefined && isJsonContainer(itemValue)) {
          sectionStack.push({
            indent,
            nextArrayIndex: Array.isArray(itemValue) ? 0 : undefined,
            path: [...parent.path, itemIndex],
          });
        }
        return;
      }

      const match = line.match(
        /^(\s*)(?:"([^"]+)"|([A-Za-z_$][\w$]*)):/,
      );
      if (!match) return;

      const indent = match[1].length;
      const key = match[2] ?? match[3];
      while (
        sectionStack.length &&
        sectionStack[sectionStack.length - 1].indent >= indent
      ) {
        sectionStack.pop();
      }

      const path = [...(sectionStack.at(-1)?.path ?? []), key];
      const value = getValueAtPath(draft, path);
      if (value === undefined) return;

      const formattedPath = formatPath(path);
      const hidesTooltip = activeCodeFile?.hiddenFieldTooltipDescendantKeys?.some(
        (hiddenKey) => {
          const hiddenKeyIndex = path.findIndex(
            (segment) => segment === hiddenKey,
          );
          return hiddenKeyIndex >= 0 && hiddenKeyIndex < path.length - 1;
        },
      );
      const tooltip = hidesTooltip
        ? undefined
        : (getFieldExplanation(path, value) ??
          activeCodeFile?.getFallbackFieldExplanation?.(path, value));
      if (tooltip) {
        explanations.set(lineIndex, {
          key,
          path: formattedPath,
          tooltip,
        });
      }

      if (isJsonContainer(value)) {
        sectionStack.push({
          indent,
          nextArrayIndex: Array.isArray(value) ? 0 : undefined,
          path,
        });
        return;
      }

    });

    return explanations;
  }, [activeCodeFile, draft, formattedCode, getFieldExplanation]);

  const resetDraft = useCallback(() => {
    setDraft(data);
    setFieldInputs(createFieldInputs(data));
    setFieldErrors({});
  }, [data]);

  const resetDraftToDefaults = useCallback(() => {
    const nextDraft = resetData ?? data;
    setDraft(nextDraft);
    setFieldInputs(createFieldInputs(nextDraft));
    setFieldErrors({});
  }, [data, resetData]);

  const hasChangesFromResetValues = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(resetData ?? data),
    [data, draft, resetData],
  );

  useEffect(() => {
    if (mode !== "view") return;

    const resetTimer = window.setTimeout(resetDraft, 0);
    return () => window.clearTimeout(resetTimer);
  }, [mode, resetDraft]);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (codeScrollResetKey === undefined) return;

    codeScrollRef.current?.scrollTo({ left: 0, top: 0 });
  }, [codeScrollResetKey]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsCodeFullscreen(
        document.fullscreenElement === codeContainerRef.current,
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const validationIssues = useMemo(() => {
    const parsingIssues = Object.entries(fieldErrors).map(
      ([path, message]) => ({ path, message }),
    );

    if (!validate) return parsingIssues;

    try {
      return [...parsingIssues, ...validate(draft)];
    } catch (error) {
      return [
        ...parsingIssues,
        {
          message:
            error instanceof Error ? error.message : "Validation failed.",
        },
      ];
    }
  }, [draft, fieldErrors, validate]);

  const setFieldError = useCallback((key: string, error?: string) => {
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      if (error) nextErrors[key] = error;
      else delete nextErrors[key];
      return nextErrors;
    });
  }, []);

  const updateFieldInput = useCallback(
    (path: JsonValuePath, input: string, originalValue: JsonValue) => {
      const pathKey = formatPath(path);
      setFieldInputs((current) => ({ ...current, [pathKey]: input }));
      const result = parseFieldInput(input, originalValue);
      setFieldError(pathKey, result.error);

      if (result.error || result.value === undefined) return;
      setDraft((current) =>
        updateValueAtPath(current, path, result.value!),
      );
    },
    [setFieldError],
  );

  const updateBooleanField = useCallback((path: JsonValuePath, value: boolean) => {
    setDraft((current) => updateValueAtPath(current, path, value));
  }, []);

  const getIssueForField = (path: string) =>
    validationIssues.find(
      (issue) =>
        issue.path === path ||
        issue.path?.startsWith(`${path}.`) ||
        issue.path?.startsWith(`${path}[`),
    );

  const canEditValue = (path: JsonValuePath, value: JsonPrimitive) =>
    isValueEditable?.(path, value) ?? true;

  const hasEditableValue = (
    value: JsonValue,
    path: JsonValuePath,
  ): boolean => {
    if (!isJsonContainer(value)) return canEditValue(path, value);

    return getEntries(value).some(([key, childValue]) =>
      hasEditableValue(childValue, [
        ...path,
        Array.isArray(value) ? Number(key) : key,
      ]),
    );
  };

  const handleModeChange = (nextMode: EditorMode) => {
    if (nextMode === "view") resetDraft();
    setMode(nextMode);
  };

  const handleCancel = () => {
    resetDraft();
    setMode("view");
  };

  const handleSave = async () => {
    if (validationIssues.length) return;

    setIsSaving(true);
    try {
      await onSave?.(draft);
      setMode("view");
      toast.success("Changes saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save JSON.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setIsSaving(true);
    try {
      const nextDraft = resetData ?? data;
      await onSave?.(nextDraft);
      resetDraftToDefaults();
      toast.success("Changes reset");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset changes.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    const copyValue =
      formattedCode ??
      (copyAs === "json"
        ? JSON.stringify(draft, null, 2)
        : buildCurlCommand(draft, curl));
    const contentName = formattedCode
      ? "Code snippet"
      : copyAs === "json"
        ? "JSON response"
        : "cURL command";

    try {
      await navigator.clipboard.writeText(copyValue);
      setCopiedTarget("primary");
      toast.success(`${contentName} copied`);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(
        () => setCopiedTarget(undefined),
        1600,
      );
    } catch {
      toast.error(`Failed to copy ${contentName.toLowerCase()}`);
    }
  };

  const handleCopyResponse = async () => {
    if (!responseData) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(responseData, null, 2));
      setCopiedTarget("response");
      toast.success("JSON response copied");
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(
        () => setCopiedTarget(undefined),
        1600,
      );
    } catch {
      toast.error("Failed to copy JSON response");
    }
  };

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(buildCurlCommand(draft, curl));
      setCopiedTarget("curl");
      toast.success("cURL command copied");
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(
        () => setCopiedTarget(undefined),
        1600,
      );
    } catch {
      toast.error("Failed to copy cURL command");
    }
  };

  const handleCodeFullscreen = async () => {
    const codeContainer = codeContainerRef.current;
    if (!codeContainer) return;

    try {
      if (document.fullscreenElement === codeContainer) {
        await document.exitFullscreen();
        return;
      }

      if (document.fullscreenElement) await document.exitFullscreen();
      await codeContainer.requestFullscreen();
    } catch {
      toast.error("Unable to open the code preview in full screen");
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    resetDraft();
    setMode("view");
    setPreviewTab("request");
    setCodeFileSelection({ codeSnippet, index: 0 });
    onOpenChange?.(nextOpen);
  };

  const renderPrimitiveField = (
    originalValue: JsonPrimitive,
    currentValue: JsonPrimitive,
    path: JsonValuePath,
  ) => {
    const pathKey = formatPath(path);
    const pathSegment = path[path.length - 1];
    const isArrayItem = typeof pathSegment === "number";
    const label = formatFieldLabel(String(pathSegment), isArrayItem);
    const inputId = `${fieldIdPrefix}-${pathKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const fieldIssue = getIssueForField(pathKey);
    const fieldExplanation = getFieldExplanation?.(path, originalValue);
    const valueType = getValueType(originalValue);
    const valueIsEditable = canEditValue(path, originalValue);

    return (
      <div
        key={pathKey}
        className="rounded-xl border border-border/70 bg-background/25 p-3.5 transition-colors focus-within:border-primary/35"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center">
            {fieldExplanation ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    htmlFor={inputId}
                    tabIndex={0}
                    className="cursor-help truncate border-b border-dashed border-muted-foreground/70 text-sm font-medium text-foreground outline-none hover:border-foreground focus-visible:border-primary"
                    aria-label={`Explain ${pathKey}`}
                  >
                    {label}
                  </label>
                </TooltipTrigger>
                <TooltipContent>{fieldExplanation}</TooltipContent>
              </Tooltip>
            ) : (
              <label
                htmlFor={inputId}
                className="truncate text-sm font-medium text-foreground"
              >
                {label}
              </label>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!valueIsEditable && (
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary/45 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <LockIcon aria-hidden="true" className="size-2.5" />
                Read only
              </span>
            )}
            <span className="rounded-md bg-secondary/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {valueType}
            </span>
          </div>
        </div>

        {typeof originalValue === "boolean" ? (
          <div className="flex h-10 items-center justify-between rounded-lg border border-input bg-background/30 px-3">
            <span className="text-sm text-muted-foreground">
              {currentValue ? "Enabled" : "Disabled"}
            </span>
            <Switch
              id={inputId}
              name={inputId}
              checked={Boolean(currentValue)}
              onCheckedChange={(value) => updateBooleanField(path, value)}
              disabled={!valueIsEditable}
              aria-invalid={Boolean(fieldIssue)}
            />
          </div>
        ) : (
          <Input
            id={inputId}
            name={inputId}
            autoComplete="off"
            type={typeof originalValue === "number" ? "number" : "text"}
            step={typeof originalValue === "number" ? "any" : undefined}
            value={fieldInputs[pathKey] ?? formatFieldInput(currentValue)}
            onChange={(event) =>
              updateFieldInput(path, event.target.value, originalValue)
            }
            readOnly={!valueIsEditable}
            aria-readonly={!valueIsEditable}
            aria-invalid={Boolean(fieldIssue)}
            aria-describedby={fieldIssue ? `${inputId}-error` : undefined}
            className="h-10 bg-background/30 [appearance:textfield] read-only:cursor-default read-only:bg-secondary/20 read-only:text-muted-foreground [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
            spellCheck={false}
          />
        )}

        {fieldIssue && (
          <p
            id={`${inputId}-error`}
            className="mt-2 text-xs font-medium text-destructive"
          >
            {fieldIssue.message}
          </p>
        )}
        <p className="mt-2 font-mono text-[10px] text-muted-foreground/65">
          {pathKey}
        </p>
      </div>
    );
  };

  const renderEditorValue = (
    originalValue: JsonValue,
    currentValue: JsonValue,
    path: JsonValuePath,
  ): ReactElement => {
    if (!isJsonContainer(originalValue)) {
      return renderPrimitiveField(
        originalValue,
        currentValue as JsonPrimitive,
        path,
      );
    }

    return (
      <div className="space-y-3">
        {getEntries(originalValue).map(([key, childOriginalValue]) => {
          const pathSegment = Array.isArray(originalValue) ? Number(key) : key;
          const childPath = [...path, pathSegment];
          const childCurrentValue = Array.isArray(currentValue)
            ? currentValue[Number(key)]
            : currentValue !== null && typeof currentValue === "object"
              ? currentValue[key]
              : childOriginalValue;

          if (!isJsonContainer(childOriginalValue)) {
            return renderPrimitiveField(
              childOriginalValue,
              childCurrentValue as JsonPrimitive,
              childPath,
            );
          }

          const sectionIsEditable = hasEditableValue(
            childOriginalValue,
            childPath,
          );
          return (
            <section
              key={formatPath(childPath)}
              className="rounded-[16px] border border-border/70 bg-background/20 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center">
                    <h3 className="text-sm font-semibold text-foreground">
                      {formatFieldLabel(key, Array.isArray(originalValue))}
                    </h3>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/65">
                    {formatPath(childPath)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary/55 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  {!sectionIsEditable && (
                    <LockIcon aria-hidden="true" className="size-2.5" />
                  )}
                  {sectionIsEditable ? "Editable values" : "Read only"}
                </span>
              </div>
              {renderEditorValue(
                childOriginalValue,
                childCurrentValue,
                childPath,
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const isInlineCodeEdit =
    mode === "edit" &&
    isMainCodeFile &&
    Boolean(formattedCode && codeSnippet?.inlineEditable);
  const keepsCodeVisibleWhileEditing = Boolean(
    codeSnippet?.inlineEditable,
  );

  const renderCodeFileTabs = () => (
    <div
      role="tablist"
      aria-label="Code files"
      className="flex min-w-0 flex-1 self-stretch overflow-x-auto"
    >
      {codeFiles.map((file, index) => {
        const isActive = index === activeCodeFileIndex;

        return (
          <button
            key={`${file.name}-${index}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              setCodeFileSelection({ codeSnippet, index });
              setCopiedTarget(undefined);
            }}
            className={`relative flex h-10 shrink-0 items-center gap-2 border-r border-border/70 px-3 font-mono text-[11px] transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
              isActive
                ? "bg-background/60 text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
            }`}
          >
            <Code2Icon aria-hidden="true" className="size-3.5 text-primary" />
            {file.name}
          </button>
        );
      })}
    </div>
  );

  const renderCodeFullscreenButton = () => (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => void handleCodeFullscreen()}
      aria-label={isCodeFullscreen ? "Exit full screen" : "Open full screen"}
      aria-pressed={isCodeFullscreen}
      className="h-7 px-2 text-[11px]"
    >
      {isCodeFullscreen ? (
        <Minimize2Icon aria-hidden="true" className="size-3.5" />
      ) : (
        <Maximize2Icon aria-hidden="true" className="size-3.5" />
      )}
      <span className="max-sm:hidden">
        {isCodeFullscreen ? "Exit full screen" : "Full screen"}
      </span>
    </Button>
  );

  const showsFooterActions = Boolean(
    viewModeAction ||
      !(copyActionsInHeaders || requestResponseTabs) ||
      mode === "edit",
  );

  const renderFooterActions = () => (
    <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-card/95 px-4 py-4 sm:px-6">
      {!copyActionsInHeaders && !requestResponseTabs && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            disabled={validationIssues.length > 0}
          >
            {copiedTarget === "primary" ? (
              <CheckIcon aria-hidden="true" />
            ) : (
              <ClipboardIcon aria-hidden="true" />
            )}
            {copiedTarget === "primary"
              ? "Copied"
              : (codeSnippet?.copyLabel ??
                (copyAs === "json" ? "Copy JSON" : "Copy as cURL"))}
          </Button>
          {responseData && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopyResponse()}
            >
              {copiedTarget === "response" ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <ClipboardIcon aria-hidden="true" />
              )}
              {copiedTarget === "response" ? "Copied" : "Copy JSON"}
            </Button>
          )}
        </div>
      )}
      {mode === "view" && viewModeAction && (
        <div className="flex min-w-0 flex-1">{viewModeAction}</div>
      )}
      {mode === "edit" && (
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={validationIssues.length > 0}
            isLoading={isSaving}
          >
            <SaveIcon aria-hidden="true" />
            Save changes
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <InspectorRoot
      open={open}
      defaultOpen={defaultOpen}
      embedded={embedded}
      onOpenChange={handleOpenChange}
    >
      {!embedded && trigger !== null &&
        (triggerTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                {trigger ?? (
                  <Button variant="outline">
                    <BracesIcon aria-hidden="true" />
                    {triggerLabel}
                  </Button>
                )}
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>{triggerTooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <DialogTrigger asChild>
            {trigger ?? (
              <Button variant="outline">
                <BracesIcon aria-hidden="true" />
                {triggerLabel}
              </Button>
            )}
          </DialogTrigger>
        ))}
      <InspectorContent
        descriptionId={descriptionId}
        embedded={embedded}
        hasDescription={Boolean(headerSubtitle)}
      >
        <DialogHeader
          className={`border-b border-border/70 pr-14 text-left ${
            isDocumentationDensity
              ? "px-4 py-4 sm:px-5"
              : "px-5 py-5 sm:px-6"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {headerBackAction && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={headerBackAction.ariaLabel ?? "Back"}
                    onClick={headerBackAction.onClick}
                    className="-ml-2"
                  >
                    <ArrowLeftIcon aria-hidden="true" className="size-4" />
                  </Button>
                )}
                {embedded ? (
                  <h2
                    className={`flex items-center gap-2 font-semibold ${
                      isDocumentationDensity ? "text-[16px]" : "text-[18px]"
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center rounded-lg bg-primary/12 text-primary ${
                        isDocumentationDensity ? "size-7" : "size-8"
                      }`}
                    >
                      <BracesIcon
                        aria-hidden="true"
                        className={
                          isDocumentationDensity ? "size-3.5" : "size-4"
                        }
                      />
                    </span>
                    {title}
                  </h2>
                ) : (
                  <DialogTitle className="flex items-center gap-2 text-[18px]">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <BracesIcon aria-hidden="true" className="size-4" />
                    </span>
                    {title}
                  </DialogTitle>
                )}
                {explanationDisplay === "tooltip" && (
                  <InfoTooltip
                    tooltip={resolvedExplanation}
                    ariaLabel={`${title} explanation`}
                    buttonClassName="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-secondary/60"
                    iconClassName="size-4"
                  />
                )}
              </div>
              {headerSubtitle && (
                <p
                  id={descriptionId}
                  className={`mt-2 max-w-[560px] leading-relaxed text-muted-foreground ${
                    explanationDisplay === "subtitle"
                      ? "text-xs"
                      : "text-sm"
                  }`}
                >
                  {headerSubtitle}
                </p>
              )}
              {headerNotice && <div className="mt-3">{headerNotice}</div>}
            </div>
          </div>
        </DialogHeader>

        <div
          className={`min-h-0 overflow-hidden ${
            isDocumentationDensity ? "p-4 sm:p-5" : "p-4 sm:p-6"
          }`}
        >
          {mode === "view" || keepsCodeVisibleWhileEditing ? (
            <div
              className={`flex h-full min-h-0 flex-col ${
                requestResponseTabs && tabsInSectionHeader
                  ? "gap-0"
                  : "gap-4"
              }`}
            >
              {isInlineCodeEdit && validationIssues.length > 0 && (
                <InlineMessage
                  variant="error"
                  icon={
                    <CircleAlertIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                    />
                  }
                >
                  <div>
                    <p>
                      Fix {validationIssues.length}{" "}
                      {validationIssues.length === 1 ? "issue" : "issues"}{" "}
                      before saving or copying.
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {validationIssues.map((issue, index) => (
                        <li key={`${issue.path ?? "root"}-${index}`}>
                          {issue.path ? `${issue.path}: ` : ""}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </InlineMessage>
              )}

              {requestResponseTabs && formattedCode && hasResponseContent && (
                <div
                  className={
                    tabsInSectionHeader
                      ? "flex flex-wrap items-center justify-between gap-2 rounded-t-[16px] border border-b-0 border-border/70 bg-secondary/35 px-4 py-3"
                      : "flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border/70 bg-secondary/25 p-2"
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <SegmentedTabs
                      aria-label="Request and response"
                      value={previewTab}
                      options={REQUEST_RESPONSE_TAB_OPTIONS}
                      onValueChange={setPreviewTab}
                      className="grid w-[180px] shrink-0 rounded-[9px] border border-border/70 bg-secondary/50 p-1 sm:w-[220px]"
                    />
                    {previewTab === "request" &&
                      isMainCodeFile &&
                      curl?.method && (
                      <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {curl.method}
                      </span>
                    )}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {previewTab === "request" &&
                      isMainCodeFile &&
                      curl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleCopyCurl()}
                        className="h-7 px-2 text-[11px]"
                      >
                        {copiedTarget === "curl" ? (
                          <CheckIcon aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ClipboardIcon aria-hidden="true" className="size-3.5" />
                        )}
                        {copiedTarget === "curl" ? "Copied" : "Copy as cURL"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void (previewTab === "request"
                          ? handleCopy()
                          : handleCopyResponse())
                      }
                      disabled={
                        (previewTab === "request" &&
                          validationIssues.length > 0) ||
                        (previewTab === "response" && !responseData)
                      }
                      className="h-7 px-2 text-[11px]"
                    >
                      {copiedTarget === previewCopyTarget ? (
                        <CheckIcon aria-hidden="true" className="size-3.5" />
                      ) : (
                        <ClipboardIcon aria-hidden="true" className="size-3.5" />
                      )}
                      {copiedTarget === previewCopyTarget ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              )}

              {formattedCode ? (
                !requestResponseTabs || previewTab === "request" ? (
              <div
                ref={codeContainerRef}
                role={requestResponseTabs ? "tabpanel" : undefined}
                aria-label={requestResponseTabs ? "Request" : undefined}
                className={`flex min-h-0 flex-1 flex-col overflow-hidden border border-border/70 bg-background/45 shadow-inner ${
                  isCodeFullscreen
                    ? "h-screen w-screen rounded-none border-0 bg-card"
                    : requestResponseTabs && tabsInSectionHeader
                      ? "rounded-b-[16px]"
                      : "rounded-[16px]"
                } ${
                  codeSnippetState === "active" && !isCodeFullscreen
                    ? "border-primary/55 ring-1 ring-primary/15 shadow-xl shadow-primary/10"
                    : ""
                }`}
              >
                <div
                  className={`flex min-h-10 items-center justify-between border-b border-border/70 bg-secondary/35 ${
                    codeFiles.length > 1 ? "" : "pl-4"
                  } ${
                    codeSnippetState === "active"
                      ? "bg-primary/[0.08]"
                      : ""
                  }`}
                >
                  {codeFiles.length > 1 ? (
                    renderCodeFileTabs()
                  ) : (
                    <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Code2Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-primary"
                      />
                      <span className="truncate">
                        {activeCodeFile?.name ??
                          codeSnippet?.language ??
                          "Code"}
                      </span>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1 px-2">
                    {codeSnippetState === "review" && (
                      <span
                        className="hidden rounded-md border border-border/80 bg-background/45 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex"
                      >
                        Previous snippet
                      </span>
                    )}
                    {editable && hasChangesFromResetValues && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleResetToDefaults()}
                        isLoading={isSaving}
                        className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                      >
                        <RotateCcwIcon aria-hidden="true" className="size-3.5" />
                        Reset
                      </Button>
                    )}
                    {(!requestResponseTabs || isCodeFullscreen) &&
                      (copyActionsInHeaders ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleCopy()}
                          disabled={validationIssues.length > 0}
                          className="h-7 px-2 text-[11px]"
                        >
                          {copiedTarget === "primary" ? (
                            <CheckIcon aria-hidden="true" className="size-3.5" />
                          ) : (
                            <ClipboardIcon aria-hidden="true" className="size-3.5" />
                          )}
                          {copiedTarget === "primary" ? "Copied" : "Copy"}
                        </Button>
                      ) : !codeSnippet?.hideStatusLabel ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                          {isInlineCodeEdit
                            ? "Editable snippet"
                            : "Populated snippet"}
                        </span>
                      ) : null)}
                    {editable && isMainCodeFile && (
                      <label
                        className={`flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-[11px] font-medium transition-colors hover:bg-secondary/60 hover:text-foreground ${
                          mode === "edit"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span>Edit</span>
                        <Switch
                          size="sm"
                          checked={mode === "edit"}
                          onCheckedChange={(checked) =>
                            handleModeChange(checked ? "edit" : "view")
                          }
                          aria-label="Edit snippet"
                        />
                      </label>
                    )}
                    {renderCodeFullscreenButton()}
                  </div>
                </div>
                <Highlight
                  theme={themes.oneDark}
                  code={formattedCode}
                  language={activeCodeFile?.syntaxLanguage ?? "typescript"}
                >
                  {({
                    className,
                    getLineProps,
                    getTokenProps,
                    style,
                    tokens,
                  }) => (
                    <pre
                      ref={codeScrollRef}
                      className={`${className} min-h-0 flex-1 overflow-auto p-4 font-mono ${
                        isDocumentationDensity
                          ? "text-[12px] leading-5"
                          : "text-[13px] leading-6"
                      } sm:p-5`}
                      style={{ ...style, background: "transparent" }}
                      aria-label={`${title} code snippet`}
                      tabIndex={0}
                    >
                      <code className="block w-max min-w-full">
                        {Children.toArray(tokens.map((line, lineIndex) => {
                          const lineProps = getLineProps({ line });
                          const lineExplanation =
                            codeLineExplanations.get(lineIndex);
                          const inlineField = isInlineCodeEdit
                            ? inlineCodeFields.get(lineIndex)
                            : undefined;
                          const inlineFieldIsEditable = Boolean(
                            inlineField &&
                              canEditValue(
                                inlineField.path,
                                inlineField.value,
                              ),
                          );
                          const colonIndex = line.findIndex(
                            (token) => token.content === ":",
                          );
                          const firstContentTokenIndex = line.findIndex(
                            (token) => token.content.trim().length > 0,
                          );
                          const prefixTokenCount =
                            colonIndex >= 0
                              ? colonIndex + 1
                              : Math.max(firstContentTokenIndex, 0);
                          const pathKey = inlineField
                            ? formatPath(inlineField.path)
                            : "";
                          const fieldIssue = pathKey
                            ? getIssueForField(pathKey)
                            : undefined;
                          const currentValue = inlineField
                            ? getValueAtPath(draft, inlineField.path)
                            : undefined;
                          const inputValue = inlineField
                            ? (fieldInputs[pathKey] ??
                              formatFieldInput(
                                currentValue ?? inlineField.value,
                              ))
                            : "";
                          const hasTrailingComma = line.some(
                            (token) => token.content === ",",
                          );
                          const inlineComment = line
                            .map((token) => token.content)
                            .join("")
                            .match(/\/\/.*$/)?.[0];

                          const renderToken = (
                            token: (typeof line)[number],
                            tokenIndex: number,
                          ) => {
                            const tokenProps = getTokenProps({ token });
                            const tokenClassName = token.types.includes(
                              "comment",
                            )
                              ? `${tokenProps.className} !text-foreground/75`
                              : tokenProps.className;
                            const isExplainedKey =
                              colonIndex >= 0 &&
                              tokenIndex < colonIndex &&
                              lineExplanation?.key ===
                                token.content.trim().replace(/^['"]|['"]$/g, "");

                            if (!isExplainedKey) {
                              return (
                                <span
                                  key={`token-${lineIndex}-${tokenIndex}`}
                                  className={tokenClassName}
                                  style={tokenProps.style}
                                >
                                  {token.content}
                                </span>
                              );
                            }

                            const keyStartIndex = token.content.lastIndexOf(
                              lineExplanation.key,
                            );

                            return (
                              <span
                                key={`token-${lineIndex}-${tokenIndex}`}
                                className={tokenClassName}
                                style={tokenProps.style}
                              >
                                {token.content.slice(0, keyStartIndex)}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      tabIndex={0}
                                      className="cursor-help border-b border-dashed border-current outline-none focus-visible:border-primary"
                                      aria-label={`Explain ${lineExplanation.path}`}
                                    >
                                      {lineExplanation.key}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {lineExplanation.tooltip}
                                  </TooltipContent>
                                </Tooltip>
                                {token.content.slice(
                                  keyStartIndex + lineExplanation.key.length,
                                )}
                              </span>
                            );
                          };

                          return (
                            <span
                              key={`line-${lineIndex}`}
                              className={`${lineProps.className} flex min-w-full`}
                              style={lineProps.style}
                            >
                              <span
                                className="block w-8 shrink-0 select-none pr-4 text-right text-muted-foreground/45"
                                aria-hidden="true"
                              >
                                {lineIndex + 1}
                              </span>
                              <span className="block flex-1 whitespace-pre">
                                {inlineField && inlineFieldIsEditable ? (
                                  <span data-inline-edit-field={pathKey}>
                                    {Children.toArray(
                                      line
                                        .slice(0, prefixTokenCount)
                                        .map(renderToken),
                                    )}
                                    {colonIndex >= 0 && " "}
                                    {typeof inlineField.value === "string" && (
                                      <span style={{ color: "#98c379" }}>
                                        &quot;
                                      </span>
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Input
                                          name={`json-inline-${pathKey}`}
                                          autoComplete="off"
                                          type={
                                            typeof inlineField.value ===
                                            "number"
                                              ? "number"
                                              : "text"
                                          }
                                          step={
                                            typeof inlineField.value ===
                                            "number"
                                              ? "any"
                                              : undefined
                                          }
                                          value={inputValue}
                                          onChange={(event) =>
                                            updateFieldInput(
                                              inlineField.path,
                                              event.target.value,
                                              inlineField.value,
                                            )
                                          }
                                          aria-label={`Edit ${pathKey}`}
                                          aria-invalid={Boolean(fieldIssue)}
                                          className="mx-1 mb-1 inline-block h-7 min-w-44 rounded-md border-primary/35 bg-background/80 px-2 py-0 align-middle font-mono text-[11px] text-foreground shadow-sm [appearance:textfield] focus-visible:border-primary md:text-[11px] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                                          style={{
                                            width: `${Math.min(
                                              Math.max(
                                                inputValue.length + 3,
                                                24,
                                              ),
                                              72,
                                            )}ch`,
                                          }}
                                          spellCheck={false}
                                        />
                                      </TooltipTrigger>
                                      {fieldIssue && (
                                        <TooltipContent>
                                          {fieldIssue.message}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                    {typeof inlineField.value === "string" && (
                                      <span style={{ color: "#98c379" }}>
                                        &quot;
                                      </span>
                                    )}
                                    {hasTrailingComma && (
                                      <span style={{ color: "#abb2bf" }}>,</span>
                                    )}
                                    {inlineComment && (
                                      <span className="!text-foreground/75">
                                        {` ${inlineComment}`}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  Children.toArray(line.map(renderToken))
                                )}
                              </span>
                            </span>
                          );
                        }))}
                      </code>
                    </pre>
                  )}
                </Highlight>
                {isCodeFullscreen &&
                  showsFooterActions &&
                  renderFooterActions()}
              </div>
                ) : null
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-border/70 bg-background/35 shadow-inner">
                  {copyActionsInHeaders && (
                    <div className="flex items-center justify-between border-b border-border/70 bg-secondary/35 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <BracesIcon
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />
                        {copyAs === "curl" ? "Request" : "JSON"}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleCopy()}
                        disabled={validationIssues.length > 0}
                        className="h-7 px-2 text-[11px]"
                      >
                        {copiedTarget === "primary" ? (
                          <CheckIcon aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ClipboardIcon aria-hidden="true" className="size-3.5" />
                        )}
                        {copiedTarget === "primary" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                    {getFieldExplanation ? (
                      <ExplainedJsonView
                        data={draft}
                        getFieldExplanation={getFieldExplanation}
                        ariaLabel={`${title} JSON tree`}
                      />
                    ) : (
                      <JsonView
                        data={draft}
                        style={jsonViewStyles}
                        shouldExpandNode={allExpanded}
                        clickToExpandNode
                        compactTopLevel
                        aria-label={`${title} JSON tree`}
                      />
                    )}
                  </div>
                </div>
              )}
              {formattedCode &&
                hasResponseContent &&
                (!requestResponseTabs || previewTab === "response") && (
                <div
                  role={requestResponseTabs ? "tabpanel" : undefined}
                  aria-label={requestResponseTabs ? "Response" : undefined}
                  className={
                    requestResponseTabs && tabsInSectionHeader
                      ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[16px] border border-border/70 bg-background/35 shadow-inner"
                      : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-border/70 bg-background/35 shadow-inner"
                  }
                >
                  {!requestResponseTabs && (
                    <div className="flex items-center justify-between border-b border-border/70 bg-secondary/35 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <BracesIcon
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                      {responseLabel}
                    </div>
                    {copyActionsInHeaders && responseData ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleCopyResponse()}
                        className="h-7 px-2 text-[11px]"
                      >
                        {copiedTarget === "response" ? (
                          <CheckIcon aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ClipboardIcon aria-hidden="true" className="size-3.5" />
                        )}
                        {copiedTarget === "response" ? "Copied" : "Copy"}
                      </Button>
                    ) : !copyActionsInHeaders ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                        Response
                      </span>
                    ) : null}
                  </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                    {responseNotice ? (
                      <InlineMessage className="mb-4 text-sm text-muted-foreground">
                        {responseNotice}
                      </InlineMessage>
                    ) : null}
                    {responseData && responseFieldExplanation ? (
                      <ExplainedJsonView
                        data={responseData}
                        getFieldExplanation={responseFieldExplanation}
                        initiallyCollapsed={responseInitiallyCollapsed}
                        ariaLabel={`${title} response JSON tree`}
                      />
                    ) : responseData ? (
                      <JsonView
                        data={responseData}
                        style={jsonViewStyles}
                        shouldExpandNode={
                          responseInitiallyCollapsed
                            ? () => false
                            : allExpanded
                        }
                        clickToExpandNode
                        compactTopLevel
                        aria-label={`${title} response JSON tree`}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full space-y-4 overflow-y-auto">
              {validationIssues.length > 0 && (
                <InlineMessage
                  variant="error"
                  icon={
                    <CircleAlertIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                    />
                  }
                >
                  <div>
                    <p>
                      Fix {validationIssues.length}{" "}
                      {validationIssues.length === 1 ? "issue" : "issues"}{" "}
                      before saving or copying.
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {validationIssues.map((issue, index) => (
                        <li key={`${issue.path ?? "root"}-${index}`}>
                          {issue.path ? `${issue.path}: ` : ""}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </InlineMessage>
              )}

              {renderEditorValue(data, draft, [])}
            </div>
          )}
        </div>

        {!isCodeFullscreen &&
          showsFooterActions &&
          renderFooterActions()}
      </InspectorContent>
    </InspectorRoot>
  );
}

export function JsonInspectorModal(props: JsonInspectorModalProps) {
  const { isDeveloperMode } = useDeveloperMode();
  const requiresDeveloperMode = props.requiresDeveloperMode ?? true;

  if (requiresDeveloperMode && !isDeveloperMode) return null;

  return <JsonInspectorModalContent {...props} />;
}

export function JsonInspectorPanel(props: JsonInspectorPanelProps) {
  return <JsonInspectorModalContent {...props} embedded />;
}
