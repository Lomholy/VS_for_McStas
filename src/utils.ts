// utils.ts

export interface ComponentParameterInfo {
    parName: string;
    type: string;
    defaultValue: string;
    docAndUnit: string;
  }
  
  export class ComponentParser {
    private file: string;
    private name: string | null = null;
    private info: string | null = null;
    private description: string | null = null;
    private pars: ComponentParameterInfo[] = [];
    private mcdisplay: string | null = null;
    private hasParsed = false;
  
    constructor(compFile: string) {
      if (!compFile) {
        throw new Error('ComponentParser: "compFile" may not be empty.');
      }
      this.file = compFile;
    }
  
    parse(): void {
      if (this.hasParsed) return;
  
      const text = this.readFile();
      if (!text) throw new Error('Component file is empty.');
  
      const { headerInfo, description, headerPSection } = this.parseComponentHeader(text);
      this.info = headerInfo;
      this.description = description;
  
      this.name = this.parseComponentName(text);
      this.pars = this.parseComponentPars(text);
      this.matchDocStringsToPars(headerPSection);
      
      this.hasParsed = true;
    }
  
    private readFile(): string {
      // Read file content logic, assuming we get the file as text.
      // For now, assuming file path is directly passed (in practice, you would use fs).
      return this.file; // Placeholder: actual reading would be done here.
    }
  
    private parseComponentHeader(text: string): { headerInfo: string, description: string, headerPSection: string } {
      // Parse header info (%I, %D, %P, %E sections)
      const posI = text.indexOf('%I');
      const posD = text.indexOf('%D');
      const posP = text.indexOf('%P');
      const posE = text.indexOf('%E');
  
      if (posI === -1 || posD === -1 || posP === -1 || posE === -1) {
        throw new Error('Missing required sections in component file.');
      }
  
      const headerInfo = text.substring(posI + 1, posD).trim();
      const description = text.substring(posD + 1, posP).trim();
      const headerPSection = text.substring(posP + 1, posE).trim();
  
      return { headerInfo, description, headerPSection };
    }
  
    private parseComponentName(text: string): string | null {
      const match = /DEFINE\s+COMPONENT\s+(\w*)/.exec(text);
      return match ? match[1] : null;
    }
  
    private parseComponentPars(text: string): ComponentParameterInfo[] {
      // Parse the parameter definitions
      const params: ComponentParameterInfo[] = [];
  
      // Example regex for "DEFINITION PARAMETERS" and "SETTING PARAMETERS"
      const paramRegex = /(\w+)\s+(\w+)\s*=\s*(\S+)(?:\s+(.+))?/g;
  
      let match;
      while ((match = paramRegex.exec(text)) !== null) {
        params.push({
          parName: match[2],
          type: match[1],
          defaultValue: match[3],
          docAndUnit: match[4] || '',
        });
      }
  
      return params;
    }
  
    private matchDocStringsToPars(headerPSection: string): void {
        const lines = headerPSection.split('\n');
        let lastPar: ComponentParameterInfo | null = null;
      
        lines.forEach(line => {
          const match = /(\w+):\s*(.*)/.exec(line);
          if (match) {
            // Use the non-null assertion operator to tell TypeScript that lastPar will not be null
            lastPar!.docAndUnit += ` ${match[2].trim()}`;
          } else {
            // Logic to set `lastPar` when a new parameter is found
          }
        });
      }
      
  }
  