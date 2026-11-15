---
type: llm
focus: trace
weight: 1
---

Votes are stored in a dedicated table/entity with a uniqueness constraint on (item, user), so a user can vote once per item at the database level
