# ReproClaw Application Search

Date: April 25, 2026

## Goal

Provide one search surface across:

1. audits
2. claims
3. evidence snippets
4. audit events
5. generated reports
6. Nia-indexed project context

## Current Implementation

The app uses a dependency-light hybrid search:

1. SQLite `LIKE` search for persisted audit data.
2. Nia search for code, docs, and indexed project context.
3. Local text scanning fallback through `ContextSearchClient` when Nia HTTP is unavailable.

The API endpoint is:

```http
GET /search?q={query}&limit=12
```

The dashboard renders these results in the audit view. Results tied to an audit or claim can open the matching audit and claim evidence panel.

## Why Not Add A Vector Database Today

Open-source projects such as Qdrant, Milvus, Haystack, txtai, FAISS, and LanceDB are good references for production semantic search. They add value when ReproClaw needs hosted indexes, reranking, embeddings pipelines, or large-scale retrieval.

For the hackathon MVP, Nia already provides the codebase memory layer. Adding a second vector index would duplicate work and increase setup risk. The current path keeps dependencies low while preserving an upgrade path.

## Future Upgrade Path

1. Keep `/search` as the stable application API.
2. Add embeddings only behind `ApplicationSearchService`.
3. Use Nia as the primary project/repo/doc index.
4. Add a vector database only for application-owned content if SQLite search becomes too weak.
5. Add reranking after result collection, not inside the dashboard.
