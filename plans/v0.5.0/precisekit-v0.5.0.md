# PreciseKit v0.5.0 — kế hoạch triển khai

## Baseline và phạm vi

Tiếp tục working tree rebrand hiện có, giữ version 0.5.0 cho cùng release chưa phát hành. Entry `src/index.ts`, tsup ESM/CJS ES2020 không minify, Rollup declarations. Không thêm dependency runtime hoặc public subpath. Giữ contract API cũ.

Baseline browser consumer (Node 22.22.3, esbuild 0.27.2): full 70,801 bytes minified / 24,783 gzip; ESM 135,634 bytes; CJS 139,736; mỗi declaration 49,929 bytes. Existing documented functions: 195. Tarball v0.4.2 có sẵn để đối chiếu. Các thay đổi migration sẵn có và release history được bảo toàn.

## Kiến trúc và public contracts

- Money: module `money`, tái sử dụng exact decimal/BigInt và rounding modes. Amount dư currency precision chỉ được làm tròn khi caller truyền mode; derived tax mặc định half-even. Allocation largest remainder, tie theo index; ratio exact NumericInput, âm không hợp lệ. Tax rate fractional, discount percentage 0–100; reject discount vượt original. Fixed-scale string results.
- Locale: module `locale`, formatToParts-derived digits, grouping và affixes; strict mặc định, ungrouped hợp lệ, grouping phải đúng locale. Standard notation, exact string output; currency/percent affix bắt buộc phù hợp option. Không Number-coerce giá trị lớn.
- Normalization: module `normalization`, schema inference từ normalizer kể cả strip; null/undefined/throw thành error. Missing default chỉ áp dụng khi absent. Own data descriptors; không getter/prototype-sensitive keys. Record all-or-failure; array collect/fail-fast với indexed successes/errors.
- Async: `function/concurrent`, shared scheduler giới hạn active tasks, stable output order, stop scheduling khi fail/abort, observe in-flight promises. Settled collects task failures nhưng abort reject operation. Lazy slices cho batch; không thêm public limiter.
- Calendar: `date/business`, input/output YYYY-MM-DD (0000–9999), civil Gregorian arithmetic độc lập TZ. Weekend 0/6 mặc định, reject cả tuần. Holidays supplied. Zero offset giữ ngày; next luôn tiến; difference [start,end), signed. Week/holiday arithmetic cho khoảng lớn.
- Security: module `security`, strict root-relative hoặc HTTP(S) allowlisted origin redirects; reject controls, credentials/backslashes/ambiguous encodings. Validate fallback. Redaction plain own data + arrays + cloned Date, preserve cycles; reject unsupported/accessors, không leak secrets. Logging strips credentials/fragments, redacts repeated keys, malformed URL thành fixed marker.

Mỗi API có accurate types/JSDoc, immutable inputs, runtime validation và focused regression tests. Root exports tích hợp sau khi module sẵn sàng. Shared helper chỉ được tạo khi có reuse thực sự.

## Thứ tự và quyền sở hữu

1. Root ghi baseline, kế hoạch, integration/release/docs work.
2. Agent money/locale sở hữu modules và tests tương ứng.
3. Agent normalization/security sở hữu modules và tests tương ứng.
4. Agent async/calendar sở hữu concurrent/business và tests tương ứng.
5. Root tích hợp barrels, consumer fixtures, docs, measurement, review chéo và gates. Agents không sửa root index/manifests/docs/scripts để tránh xung đột.

## Documentation và release automation

Giữ static single-page architecture và anchors; cải thiện search/category navigation/related functions/mobile. README ngắn dẫn tới detailed reference; mọi API được documented, runnable examples, async illustrative examples được test riêng. Manifest cung cấp current identity/URLs/version; changelog cung cấp current release summary; export inventory cung cấp counts; measured report cung cấp current bundle claims. Migration 0.4.2→0.5.0 và historical comparison cố định.

## Verification và stop condition

Focused tests cho từng module: exact/oracle/property allocation; malformed locale grouping/digits; getter/proxy/prototype/cycle/leak; async concurrency/abort/rejections/listener cleanup; calendar century/leap/large/TZ; positive và negative installed TS inference. Full check/coverage, Bun, build/docs sync/package/docs/site/tarball/pack gates. Browser desktop/mobile dưới /precisekit/ kiểm tra search/copy/playground/anchors/accessibility. Bundle before/after cùng methodology, brotli và module fixtures; legacy named import tăng >5% phải điều tra, không hard cap full bundle.

Hoàn tất khi 6 nhóm export/document/test đầy đủ, gates pass và report bằng chứng. External release actions không nằm trong phạm vi. Không publish/push/tag/deprecate/deploy. Final report nêu đúng pass/fail/blocked và manual review readiness.
