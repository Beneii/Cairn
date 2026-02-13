# Build Fix Instructions

I identified the issue causing the `@cairn/builder` build failure on your server.

**Issue:**
There were tracked build artifacts (`.js`, `.d.ts`, `.map` files) in `packages/builder/src` which were likely causing conflicts during the build process on the server, especially after updates.

**Fix:**
I have:
1. Removed all tracked compiled files (`.js`, `.d.ts`) from `packages/builder/src`.
2. Updated `.gitignore` to prevent them from being tracked in the future.
3. Verified that `pnpm build` works locally with these changes.
4. Committed these changes to your local git repository.

**Next Steps (Required):**
Since I could not push to your remote repository (due to authentication limits), please:
1. **Push the changes:**
   ```bash
   git push origin main
   ```
2. **Retry the update on your server:**
   Run "Pull & Restart" again.

This should resolve the exit code 2 error.
