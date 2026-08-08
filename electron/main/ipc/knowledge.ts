import { dialog, ipcMain, shell } from "electron";
import {
  deleteDocument,
  importDocument,
  listDocuments,
  reprocessDocument,
  searchDocuments,
  updateDocument,
  type DocumentMetadata,
  type DocumentSearchFilters
} from "../ai/documentKnowledge";
import { getSqlite } from "../database";

export function registerKnowledgeHandlers() {
  ipcMain.handle("documents:selectAndImport", async (_event, metadata: DocumentMetadata) => {
    const selected = await dialog.showOpenDialog({
      title: "Bilgi tabanına doküman ekle",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Desteklenen dokümanlar", extensions: ["pdf", "txt", "md", "markdown", "html", "htm", "docx"] }]
    });
    if (selected.canceled) return { canceled: true, imported: [] };
    const imported = selected.filePaths.map((filePath) => importDocument(filePath, metadata));
    return { canceled: false, imported };
  });

  ipcMain.handle("documents:list", async () => listDocuments());
  ipcMain.handle("documents:update", async (_event, id: number, metadata: DocumentMetadata & { isActive?: boolean }) => {
    updateDocument(id, metadata);
    return { success: true };
  });
  ipcMain.handle("documents:reprocess", async (_event, id: number) => {
    reprocessDocument(id);
    return { success: true };
  });
  ipcMain.handle("documents:delete", async (_event, id: number) => {
    deleteDocument(id);
    return { success: true };
  });
  ipcMain.handle("documents:openSource", async (_event, id: number) => {
    const row = getSqlite().prepare("SELECT file_path FROM rag_documents WHERE id=?").get(id) as { file_path: string } | undefined;
    if (!row) throw new Error("Doküman bulunamadı.");
    const error = await shell.openPath(row.file_path);
    if (error) throw new Error(error);
    return { success: true };
  });
  ipcMain.handle("documents:getChunks", async (_event, id: number) => {
    return getSqlite().prepare(`SELECT id, chunk_index AS chunkIndex, section_title AS sectionTitle,
      page_start AS pageStart, page_end AS pageEnd, content_type AS contentType, command_name AS commandName,
      heading_level AS headingLevel, content, token_count AS tokenCount, is_deprecated AS isDeprecated FROM rag_document_chunks
      WHERE document_id=? ORDER BY chunk_index`).all(id);
  });
  ipcMain.handle("documents:getExtractedCommands", async (_event, id: number) => {
    return getSqlite().prepare(`SELECT id, chunk_id AS chunkId, command_template AS commandTemplate,
      source_page AS sourcePage, extraction_confidence AS extractionConfidence,
      verification_status AS verificationStatus, metadata FROM rag_document_extracted_commands
      WHERE document_id=? ORDER BY id`).all(id);
  });
  ipcMain.handle("rag:testSearch", async (_event, query: string, filters: DocumentSearchFilters) => searchDocuments(query, filters));
}
