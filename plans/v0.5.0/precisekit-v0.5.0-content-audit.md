# PreciseKit v0.5.0 — báo cáo audit nội dung và metadata

## Phạm vi và nguyên nhân gốc

Audit bổ sung trên cùng logical release chưa phát hành `0.4.2 → 0.5.0`; không tăng tiếp version. Giữ toàn bộ implementation sáu nhóm tính năng và thay đổi migration đã có. Đợt audit này không sửa runtime source, signature hoặc behavior.

Metadata trước đây có nhiều bản sao biên tập riêng: description trong manifest, README, hero, SEO/social và SoftwareSourceCode; FAQ JSON-LD cũng khác nội dung hiển thị. Đồng bộ version đơn thuần không ngăn mô tả cũ tồn tại. Một số claim không có bằng chứng tương ứng: mọi ví dụ đều chạy, full parity với oracle, minimum Bun, timing dưới 0,2 giây và không còn gì cần audit khi zero dependencies.

## Thay đổi

- `package.json`: description theo định vị đã yêu cầu, thêm `branding` làm nguồn cho display name, tagline, SEO title và SEO description. Identity/version/URLs vẫn từ manifest. Không thêm dependency.
- `scripts/sync-docs.mjs`: sinh branding cho README/site/meta/OG/Twitter/JSON-LD; sinh FAQ từ câu trả lời thực tế; escape JSON trong script, decode HTML entity một lần, hỗ trợ FAQ nhiều dòng và fail nếu bỏ sót câu hỏi. Giữ kiểm tra marker duy nhất và current release summary từ đúng changelog entry. Sinh GitHub About proposal cục bộ, không gọi GitHub API.
- `scripts/verify-site.mjs`: kiểm tra khớp manifest cho branding/description/README/About/lockfile, FAQ hiển thị so với JSON-LD, local asset paths, Releases deep link, bundle build hash/count và các claim đã xác định sai. Không bỏ assertion cũ.
- `scripts/verify-docs-sync.mjs`: regression với version/branding/description giả trong consumer tạm; kiểm tra escaping `</script>`, FAQ nhiều dòng và entity không bị decode hai lần, cùng các kiểm tra idempotence/history/duplicate markers.
- `README.md`, `docs/index.html`, `docs/api-data.js`, `SECURITY.md`: sửa định vị, giới hạn claim đúng tính năng, bỏ benchmark timing chưa xác minh và minimum Bun chưa chứng minh; phân biệt deepMerge bỏ unsafe keys với setByPath reject. Khôi phục primary Releases link về `#releases` và sửa fallback README overview.
- `scripts/measure-bundle.mjs`, `docs/bundle-data.json`: measurement schema và artifact identifier portable, không chứa absolute workspace path. Số liệu vẫn lấy từ build thực tế.
- `.github/repository-metadata.json`: About proposal gồm tên repo, description, homepage, topics. `.github/workflows/ci.yml` kiểm tra generated diff cả README/About ngoài docs; rule release ghi lại nguồn metadata.

Lịch sử changelog, migration mốc cố định và historical size comparisons được bảo toàn. Các reference tên cũ còn lại trong active docs là nội dung migration/release-history; không còn active installation/import/URL trỏ sang package/repo cũ. Local git remote đã là repository PreciseKit; không đổi remote.

## Verification thực tế

| Lệnh/check | Kết quả |
| --- | --- |
| `npm run build` | PASS ESM/CJS + `.d.ts`/`.d.mts` |
| `npm run docs:sync` | PASS, rerun idempotent qua regression |
| `npm run test:docs` | PASS: 216 documented functions, 377 examples checked, 5 expectations skipped; run:false illustrative entries không được coi là executed |
| Docs sync regression | PASS: version/branding/SEO/README/About, JSON-LD escaping, multiline FAQ, single-pass entities, history, idempotence, missing/duplicate marker/canonical rejection |
| `npm run test:site` | PASS: strict branding/SEO/FAQ/URLs/assets/count/release/bundle consistency |
| `npm run test:package` | PASS Node v22.22.3, ESM + CommonJS self-reference |
| `npm run check` | PASS typecheck, lint, 20 suites/1534 tests, build |
| Coverage do Jest trong check | statements 96,89%; branches 92,60%; functions 98,61%; lines 98,91% |
| `env npm_config_cache=/tmp/precisekit-npm-cache npm run test:tarball` | PASS consumer tạm sạch: Node/Bun ESM+CJS runtime/export parity, declarations `.mts`/`.cts`, positive/negative TypeScript assertions |
| `npm pack --dry-run --ignore-scripts --json` | PASS identity @fatdevcon/precisekit@0.5.0, 10 files, không sourcemaps/internal source/docs/tooling, bundled dependencies rỗng |
| `npm run test:bundle` | PASS browser consumer fixtures và tree-shaking; kết quả dưới đây |
| `npm run test:bun` | PASS Bun 1.3.5: 1226 pass, 2 conditional Node18-only skips, 0 fail; 191847 assertions |
| Chrome headless dưới `/precisekit/` | PASS 1440/768/390px: search/category, deep-link/reload, playground samples, copy, theme, không overflow ngang hoặc runtime exception |
| `git diff --check` | PASS |

Lần chạy docs regression trong sandbox ban đầu bị `spawnSync EPERM`; chạy lại có quyền cho child processes đã PASS, không sửa test để né lỗi môi trường.

## Package và bundle impact

- Tarball: **131139 bytes packed**, **497954 bytes unpacked**, đúng 10 files. Metadata và README/SECURITY thay đổi packed size; runtime artifact hash và kích thước không đổi so với implementation đã kiểm tra trước audit.
- Full browser consumer: **86535 bytes minified**, **29801 bytes gzip**, **26171 bytes Brotli**, esbuild 0.27.2. Không nhầm với raw ESM dist **163698 bytes**.
- Named subsystem gzip: money 6137; locale 6092; normalization 1765; concurrency 1174; business calendar 1460; security 1728 bytes. Các fixtures và hash nằm trong `docs/bundle-data.json`.
- 221 runtime exports, 216 documented function entries; không tuyên bố hai số đếm này là một. Không thêm runtime dependencies, giữ sideEffects false và named exports.

## Giới hạn và việc maintainer cần làm

- `.github/repository-metadata.json` là cấu hình mong muốn để review; chưa đọc hoặc cập nhật GitHub About từ xa. Chưa xác minh URL mới đang được registry/hosting phục vụ; local metadata consistency không chứng minh trạng thái external service.
- Node 18/20/24 matrix và hosted CI chưa chạy trong đợt local này. Node local là 22.22.3, Bun 1.3.5; không claim minimum Bun cụ thể.
- Docs có illustrative examples và các expectation phụ thuộc môi trường bị skip như runner báo; không gắn nhãn tất cả examples là executed.
- Browser functional checks đã pass và đã xem lại screenshot mobile. Đây không phải claim đạt toàn bộ optional aesthetic score của design skill; các giới hạn thiết kế đã ghi trong release report trước vẫn được giữ nguyên.
- Không commit, push, tag, publish, deprecate, đổi tên repo hoặc deploy.
