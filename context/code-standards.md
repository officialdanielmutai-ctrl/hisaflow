## Code Standards

### Implementation Rules
- TypeScript strict mode.
- ESLint with recommended rules + prettier.
- No `any` unless absolutely necessary.
- Prefer `const` over `let`.
- Use `async/await` not raw promises.
- Imports order: third-party, internal absolute, relative.
- File naming: `kebab-case` for files, `PascalCase` for classes/interfaces/React components, `camelCase` for variables/functions.
- Tests: every module has `.spec.ts` file beside it.
- Always define Prisma model before service.
- Dependency injection via constructor.
