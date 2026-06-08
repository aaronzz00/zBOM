# Lark CLI Auth Integration

## Goal
Integrate the local `lark-cli` auth flow into the zBOM local Fastify server and React frontend to enable automatic role-mapped write permissions and viewer-only fallbacks.

## Tasks
- [x] Task 1: Add `.zbom.lark.json` to `.gitignore` and create `.zbom.lark.json` mapping configuration → Verify: Check `.gitignore` contains the config filename.
- [x] Task 2: Create `server/auth/lark.ts` to execute `lark-cli contact +get-user` and load configuration → Verify: Run a test import or standalone node check of the helper.
- [x] Task 3: Modify `/api/auth/me` in `server/routes/auth.ts` to query `lark-cli` on authentication check → Verify: Make an API request to `/api/auth/me` without cookie, check if user profile is returned.
- [x] Task 4: Create a mock-based unit test file `server/tests/larkAuth.test.ts` to test various CLI output states → Verify: Run `npm run test:api` and see tests pass.
- [x] Task 5: Modify `services/backendApi.ts` and `stores/useAuthStore.ts` to handle dynamic login and viewer fallback roles → Verify: Ensure frontend builds and loads.
- [/] Task 6: Add a UI popup modal in `App.tsx` for write action authorization failure and terminal login prompt → Verify: Trigger a mock 401 error, verify popup shows correct instructions.

## Done When
- [ ] Backend seamlessly maps active `lark-cli` user to Admin/Eng/Sourcing role.
- [ ] Frontend falls back to VIEWER mode when logged out, and displays terminal login instruction modal upon write attempt failure.
- [ ] All automated tests pass successfully.

## Notes
- Mappings config file `.zbom.lark.json` is Git-ignored and created locally on user's machine.
- Verification uses `lark-cli contact +get-user` as it contains complete user profile metadata (open_id, name, etc.).
