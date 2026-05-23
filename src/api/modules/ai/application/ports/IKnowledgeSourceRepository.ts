export interface KnowledgeSourceRecord {
  id: string;
  tenantId: string;
  status: string;
  contentHash: string | null;
}

export interface IKnowledgeSourceRepository {
  findById(
    tenantId: string,
    sourceId: string,
  ): Promise<KnowledgeSourceRecord | null>;
  updateStatus(
    tenantId: string,
    sourceId: string,
    status: string,
  ): Promise<void>;
  markSynced(
    tenantId: string,
    sourceId: string,
    status: string,
    contentHash: string,
  ): Promise<void>;
}

export const KNOWLEDGE_SOURCE_REPOSITORY = Symbol(
  'KNOWLEDGE_SOURCE_REPOSITORY',
);
