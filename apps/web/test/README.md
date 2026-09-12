Run the browser-storage recovery checks with Node.js 24 or newer:

```sh
node --test apps/web/test/import-progress.test.mjs
```

Manual funnel checks (with GA enabled):

- Open `/upload`, or a valid `/r/[token]` or `/pair/[token]` without an active session. The example must be labeled as an example; the file picker appears after `내 연결 알아보기` (`start_click`).
- Open `어디서 받나요?` (`download_guide_open`). The inline four-step guide must preserve the invitation. The official request button includes Instagram account, JSON format, and all-time query parameters (`instagram_export_open`).
- Open Instagram export and return: the file picker must be visible immediately, without an intermediate waiting screen. Reload or leave and return: the same invitation must resume at the file picker with `인스타에서 준비된 파일 받기` (`instagram_export_reopen`) and the OS-specific download-folder hint.
- From the standalone guide, select `이미 받은 파일 선택하기`: `/upload` must open directly at the file picker, while `seconds_since_export_open` remains absent because Instagram export was not opened.
- Visiting the standalone guide alone must not create resume progress. If the user then opens Instagram or continues to a file, the original guide-open time must be stored so `seconds_since_guide` remains measurable.
- Reload or reopen the home page in the same browser. The resume link returns to the original invitation with the importer visible. Browser storage retains the route and first guide-open time for up to seven days; it does not retain the file or account input. Expired invitations remain invalid.
- Select a file (`file_selected`, including `valid_type`, `seconds_since_export_open`, and, after viewing the guide, `seconds_since_guide`). Test a non-ZIP, malformed ZIP, and valid Instagram export.
- Successful ingestion emits `upload_success`, and for invitation sources also `invite_upload_success`. A later result-fetch failure emits `result_error`, not `upload_error`.
- Existing participants can still confirm without importing again. Completing the result clears the matching resume link.
- Existing link-generation measurement remains `referral_link_create`. Use `source` (`direct`, `referral`, `pair`) to split the import funnel. Do not limit analysis to same-session completion: export preparation can span visits.

These events do not include account names, filenames, invite tokens, or invitation URLs in their custom parameters. GA delivery needs to be checked in DebugView on a configured deployment.
