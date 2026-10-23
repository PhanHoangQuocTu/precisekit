# PreciseKit v0.5.0 — báo cáo xác minh

## Quyết định release

Release candidate sẵn sàng cho maintainer review với các package/code gates đã pass.
Chưa publish, push, tag, deprecate, đổi repository hoặc deploy. CI được cập nhật nhưng chưa chạy trên GitHub; Node 18/20/24 compatibility matrix còn cần CI xác nhận, local run dùng Node 22.22.3 và Bun 1.3.5.

Version giữ 0.5.0 cho cùng big update chưa phát hành; baseline lịch sử là @fatdevcon/utilities@0.4.2. Toàn bộ thay đổi worktree ban đầu được bảo toàn.

## Kiến trúc và API

Đã thêm 21 functions, 200 → 221 runtime exports. 216 documented functions (baseline 195); năm exports compatibility/internal cũ được giữ nguyên. So sánh runtime export inventory với tarball 0.4.2: không mất export nào.

| Nhóm | APIs |
| --- | --- |
| Money | toMinorUnits, fromMinorUnits, allocateMoney, calculateTax, applyDiscount |
| Normalization | normalizeRecord, normalizeArray |
| Locale | parseLocalizedNumber, parseLocalizedCurrency, parseLocalizedPercent |
| Async | mapConcurrent, mapSettledConcurrent, batchAsync |
| Calendar | isBusinessDay, addBusinessDays, differenceInBusinessDays, nextBusinessDay |
| Security | isSafeRedirectUrl, getSafeRedirectTarget, redactSensitiveFields, sanitizeUrlForLogging |

Source mới nằm tại modules money, locale, normalization, security, function/concurrent và date/business. Root entry giữ tất cả exports cũ, bổ sung các module mới. Tái sử dụng numeric validation/error types và decimal/BigInt representation; không thêm public limiter hoặc runtime dependency. Mỗi API mới có JSDoc, options/results chính xác và test riêng.

Quyết định quan trọng: tiền dư precision cần roundingMode rõ ràng; tax phát sinh half-even mặc định; allocation exact largest remainder/tie theo index. Normalization nullish/throw là failure; array partial success có index. Business calendar date-only 0000–9999, difference [start,end), không lệ thuộc TZ. Locale strict ICU digits/affixes/grouping. Async ngừng scheduling khi fail/abort và observe in-flight rejections. Redaction giữ cycles nhưng reject unsupported/accessors; malformed log URL thành marker cố định.

## Bằng chứng kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| Baseline npm run check | PASS — 14 suites / 1452 tests |
| npm run check (final source) | PASS — typecheck, lint, 20 suites / 1534 tests, build JS + declarations |
| npm run test:coverage -- --runInBand | PASS — 1534 tests; statements 96.89%, branches 92.60%, functions 98.61%, lines 98.91% |
| npm run test:bun (13 suites) | PASS — 1226 pass, 2 conditional Node-18-only skips, 0 fail; 191847 assertions |
| npm run docs:sync | PASS — copied current ESM, metadata/counts/current measurements synchronized |
| npm run test:docs | PASS — 216 functions, 377 examples, 5 pre-existing illustrative skips; release-transition regression PASS |
| npm run test:site | PASS — strict metadata/structured data/changelog/count/hash/anchors/parser checks |
| npm run test:package | PASS — ESM/CJS old behavior + all 21 new APIs |
| npm run test:tarball | PASS — clean installed Node/Bun ESM/CJS and strict NodeNext .mts/.cts consumers |
| npm pack --dry-run --ignore-scripts --json | PASS — 10 intended files; 130867 bytes packed / 496814 unpacked; no bundled dependencies/maps/internal files |
| npm run test:bundle | PASS — browser self-contained bundles, selected-export parity, import without Intl |
| TZ=America/New_York focused date/calendar tests | PASS — 2 suites / 41 tests |
| Agent calendar TZ=Asia/Ho_Chi_Minh | PASS |
| Chrome 1440/768/390px under /precisekit/ | PASS — search/category, quote-containing descriptions, hash/direct navigation/reload, playground, copy, theme, horizontal overflow |
| git diff --check | PASS |

Installed TypeScript fixtures verify inferred normalized records, readonly batch inputs, result narrowing, bigint/string returns, redacted field widening, valid option values and negative @ts-expect-error contracts.

Critical regression coverage: seven rounding modes against decimal.js, 2000 exact allocation ratios, signed allocation totals, huge tax inputs, 0/2/3-decimal currencies USD/EUR/VND/JPY/KWD; 208 committed Intl round trips and independent 2205-roundtrip probe across 105 locales; accessor/proxy/prototype/cycle/secret cases; malformed redirect encodings and Unicode; async bound/order/sync rejection/late rejection/abort cleanup; leap centuries, years 0–99, full calendar range, sparse holiday/weekend rejection and daily-oracle checks.

## Bundle comparison

Cùng Node v22.22.3, esbuild 0.27.2, browser IIFE ES2020, minification/tree-shaking, gzip level 9. Brotli dùng Node zlib defaults. Baseline tarball 0.4.2 được đo lại cùng tool; không dùng số marketing hoặc minify dist.

| Measurement | v0.4.2 | v0.5.0 | Thay đổi |
| --- | ---: | ---: | ---: |
| ESM raw bytes | 135634 | 163698 | +20.69% |
| CJS raw bytes | 139736 | 168377 | +20.50% |
| Mỗi declaration raw bytes | 49929 | 69665 | +39.53% |
| Full consumer minified bytes | 70801 | 86535 | +22.22% |
| Full consumer gzip bytes | 24783 | 29801 | +20.25% |
| Full consumer Brotli bytes | 21663 | 26171 | +20.81% |

Tất cả 14 legacy named-import fixtures giữ nguyên minified byte size. Gzip thay đổi tối đa 1 byte do tên binding trong bundle; không có regression >5%. Full-root growth là chi phí 21 APIs mới. Runtime dependencies vẫn bằng 0; builds giữ readable/unminified, sideEffects:false và export topology hiện có.

Subsystem consumer gzip bytes: money 6137, locale 6092, normalization 1765, concurrency 1174, calendar 1460, security 1728. Money/locale bao gồm primitives exact arithmetic và currency snapshot; các module nhẹ khác không kéo chúng vào.

Chi tiết máy đọc được: precisekit-v0.5.0-measurements.json; current public measurement docs/bundle-data.json có ESM SHA-256 để chống stale claims.

## Docs, automation và migration

Giữ single-page static docs và existing anchors; thêm collapsible function contracts, category filter, description/category search, related links và 6 nhóm reference mới. Hero hai dòng ở desktop/mobile, README rút còn hướng dẫn thực hành; playground chạy APIs đồng bộ mới với parser allowlist hiện có. Async examples được đánh dấu illustrative và kiểm tra qua unit tests.

docs:sync lấy current identity/version/URLs từ manifest; release summary lấy đúng changelog section; measurements gắn hash build; function count lấy reference inventory. Migration 0.4.2→0.5.0 và historical bundle comparisons giữ nguyên. Regression fixture chứng minh version tương lai, idempotence, missing marker, duplicate end marker và duplicate canonical đều được xử lý nghiêm.

Review chéo đã sửa: style-specific ICU grouping; sparse calendars; malformed normalization callback results; quote escaping trong search attributes; uniqueness checks; stale release bullets; malformed Unicode redirect targets. Thay assertion network có “|| true” cũ bằng kiểm tra network-call primitives thực tế.

CI thêm docs-generated-diff gate và packed-consumers job (Bun + tarball). Workflow publication giữ quy trình hiện có. Migration guide và announcement draft: docs/migration-from-utilities.md.

## Giới hạn và manual review

- Runtime ICU/CLDR quyết định currency exponent/locale pattern; strict affixes/spacing được documented. Không official holiday database, tax-law engine hay SSRF protection.
- Caller normalizers/in-flight tasks có thể chạy code riêng; helper không hứa undo side effects hoặc tự hủy task bên ngoài.
- Chrome functional checks pass; đây chưa phải audit WCAG chuyên dụng. Visual taste inspector vẫn báo các tiêu chí marketing (ảnh/video/motion, code-style labels, outlines, typography); không được ghi nhận là pass. Approved static documentation design được giữ, không thêm ảnh/animation để thỏa marketing heuristics. Hero giảm 3→2 dòng và không có page overflow; default reference height giảm khoảng 150277→45951px qua disclosure.
- Build/package tests local dùng Node22/Bun; actual GitHub Actions matrix và public GitHub/npm/docs links cần maintainer kiểm tra sau external actions.
- Chỉ local tarball đã được tạo tại .release/fatdevcon-precisekit-0.5.0.tgz; mọi publication/hosting/deprecation vẫn là thao tác thủ công riêng.

## Checklist

- [x] Sáu nhóm source + public types/JSDoc + regression tests.
- [x] Existing exports/contracts preserved; installed ESM/CJS/TS fixtures.
- [x] Zero runtime dependencies, readable builds, real tree-shaking measurements.
- [x] Docs examples/playground/metadata/migration/history synchronized.
- [x] Package/code/docs gates and browser interaction checks pass locally.
- [x] Bundle before/after report and release plan.
- [ ] Maintainer review và GitHub Actions Node compatibility matrix.
- [ ] External repository/registry/docs operations, chỉ khi được cho phép.
