declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfResult {
    numpages: number;
    text: string;
  }

  interface PdfOptions {
    pagerender?: (pageData: {
      getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
    }) => Promise<string>;
  }

  export default function pdfParse(buffer: Buffer, options?: PdfOptions): Promise<PdfResult>;
}
