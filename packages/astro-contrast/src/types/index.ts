export interface ParsedAstroFile {
  filePath: string;
  htmlNodes: HtmlElementInfo[];
  styleRules: CssRuleInfo[];
  customProperties: Map<string, string>;
  linkedCssHrefs: string[];
  styleImports: string[];
}

export interface HtmlElementInfo {
  tagName: string;
  classes: string[];
  id: string | null;
  inlineStyles: InlineStyleInfo | null;
  position: NodePosition;
  hasTextContent: boolean;
  ignored: boolean;
  parentElement?: HtmlElementInfo | null;
}

export interface NodePosition {
  line: number;
  column: number;
}

export interface CssRuleInfo {
  selector: string;
  declarations: CssDeclarationInfo[];
  ignored: boolean;
}

export interface CssDeclarationInfo {
  property: string;
  value: string;
  resolvedValue: string | null;
}

export interface InlineStyleInfo {
  color: string | null;
  backgroundColor: string | null;
  fontSize: string | null;
  fontWeight: string | null;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface ColorPair {
  element: HtmlElementInfo;
  foreground: ColorInfo;
  background: ColorInfo;
  fontSize: string | null;
  fontWeight: string | null;
}

export interface ColorInfo {
  original: string;
  rgb: RgbColor | null;
  source: 'inline' | 'stylesheet';
  selector: string;
}

export interface ContrastResult {
  filePath: string;
  element: HtmlElementInfo;
  foreground: ColorInfo;
  background: ColorInfo;
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  level: 'pass' | 'aa-fail' | 'aaa-only';
  isLargeText: boolean;
}

export interface FileAnalysisResult {
  filePath: string;
  results: ContrastResult[];
  errors: AnalysisError[];
  stats: {
    elementsAnalyzed: number;
    pairsChecked: number;
    passing: number;
    aaFailing: number;
    aaaOnlyFailing: number;
    unresolvable: number;
  };
}

export interface AnalysisError {
  message: string;
  element?: HtmlElementInfo;
  type: 'parse-error' | 'color-resolve-error' | 'selector-match-error';
}

export interface IgnorePair {
  foreground: string;
  background: string;
}

export interface IgnoreConfig {
  /** Color values to ignore wherever they appear (as foreground or background) */
  colors?: string[];
  /** Specific foreground+background combinations to ignore */
  pairs?: IgnorePair[];
  /** CSS selectors to ignore — supports .class, #id, tag, and wildcards like .brand-* */
  selectors?: string[];
}
