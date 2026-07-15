# HPAI human dashboard · 禽流感人類疫情監測與文獻整合平台

以 **Source–Pathway–Human Host** 框架量化台灣 HPAI（H5N1）人類暴露風險的公開資料平台。中英雙語、純靜態、無後端。
NTUH × 台大 H5N1 人類暴露風險計畫（PI 溫在弘／協同 張惠雯，工作項目 2-4）。

> **免責**：本站彙整自公開監測資料與學術文獻，供學術研究參考，非官方即時疫情通報系統。每個數字均可溯源至原始出處。

## 兩大模組

- **監測儀表板**（`docs/index.html`）：全球累積人類病例（WHO 2003–2026）、CFR、台灣三口徑（H5N1 本土／全亞型本土／含境外累計）、**世界人類病例 choropleth**、突變監測儀（V(i) 標記）、流行株兩軸、文獻面向分布、本季概況、資料來源登錄。
- **文獻情報**（`docs/literature.html`）：欄位搜尋、**關鍵字共現網絡圖**（d3-force，點節點串聯 AND 篩選）、可點國家的研究地點地圖、54 筆文獻結果卡片。

## 技術

純靜態站，全 CDN（Bootstrap 5 + Chart.js + d3 + topojson），可直接 GitHub Pages 部署。
資料由 Node + SheetJS 從 Excel 主檔建置，無 Python。

## 資料管線

```
文獻資料庫_HPAI_H5N1.xlsx（主檔，Excel 編輯）
  └─ lexicon/  領域詞庫、國別對照、資料來源登錄、監測種子、WHO 分國病例、i18n
        └─ build/build-all.mjs  （SheetJS 讀 xlsx＋種子 → JSON）
              └─ docs/data/*.json  （前端讀取）
```

指令：

```bash
npm install          # 安裝 SheetJS
npm run build        # 重建 docs/data/*.json
npm run serve        # 本機預覽 http://localhost:4178
npm run validate     # 驗證關鍵字標註對得上詞庫
```

## 目錄

- `docs/` — 發布的靜態站（GitHub Pages 由此 /docs 提供）
- `build/` — Node 建置與本機伺服器腳本
- `lexicon/` — 詞庫與策展種子 JSON（人工維護）

## 資料來源

WHO/GIP（人類病例累計）、US CDC（全球摘要）、台灣疾管署（本土/境外個案）、農業部防檢署（禽場/野鳥）、期刊與預印本（分子演化）。詳見站內「資料來源」頁與各數字的 ⓘ 來源連結。

## 更新節奏

季度深報（1/4/7/10 月）＋每月哨兵輕掃，累積至 Excel 主檔後重跑 `npm run build` 並 push。
