## AI Workflow Rules

### Development Workflow
1. Fetch latest `main` branch.
2. Create feature branch from `main`.
3. Follow TDD: write test first for unit, then implement.
4. Run `npm run test:ci` before commit.
5. Merge via squash commit when approved.

### Scoping Rules
- Each task must fit within one session.
- Break large tasks into sub-tasks.
- Implement backend first, then frontend.
- Document any new endpoints in OpenAPI spec.

### Delivery Approach
- Daily integration to `main`.
- Use feature flags in production.
- Do not deploy without review.
