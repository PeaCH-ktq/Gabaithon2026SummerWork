/**
 * Gemini が生成した SVG のサーバー側バリデーション。
 *
 * Gemini への入力はユーザーがアップロードしたファイルなので、プロンプトインジェクション
 * 経由で危険な SVG が返る可能性を前提にする。ここでは **書き換えはせず、少しでも怪しければ
 * 丸ごと捨てる**（`null` を返す）。DOM 挿入直前のサニタイズは別途 DOMPurify で行う。
 *
 * 文字・数式は SVG に入れず `figure.labels` で受け取り KaTeX で描画するため、
 * `text` / `tspan` は許可要素に含めない。
 */

/** 図形・線・軸に使う要素のみ許可。 */
const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "marker",
  "path",
  "line",
  "polyline",
  "polygon",
  "rect",
  "circle",
  "ellipse",
  "title",
  "desc",
]);

const MAX_LEN = 8000;

export interface ValidSvg {
  /** 検証を通した SVG マークアップ（入力そのまま）。 */
  svg: string;
  /** viewBox の幅・高さ。 */
  width: number;
  height: number;
}

/** 危険な構造を含めば `null`。問題なければ SVG と viewBox 寸法を返す。 */
export function validateSvg(svg: string): ValidSvg | null {
  const s = svg.trim();

  if (!s.startsWith("<svg") || !s.endsWith("</svg>")) return null;
  if (s.length > MAX_LEN) return null;

  // viewBox="0 0 W H" があり、W/H が妥当な範囲か。
  const vb = s.match(
    /viewBox\s*=\s*["']\s*0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*["']/,
  );
  if (!vb) return null;
  const width = Number(vb[1]);
  const height = Number(vb[2]);
  if (!(width > 0 && width <= 2000 && height > 0 && height <= 2000)) return null;

  // 危険な要素・属性・スキーム。
  if (
    /<\s*(script|style|foreignObject|iframe|image|use|a|text|tspan|animate\w*|set|handler)\b/i.test(
      s,
    )
  ) {
    return null;
  }
  if (/\son[a-z]+\s*=/i.test(s)) return null;
  if (/\sstyle\s*=/i.test(s)) return null;
  if (/(xlink:)?href\s*=/i.test(s)) return null;
  if (/javascript:|data:|<!ENTITY|<!DOCTYPE/i.test(s)) return null;
  if (/url\(\s*(?!#)/i.test(s)) return null;

  // 出現するタグ名がすべて許可リスト内か。
  const tags = s.match(/<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/g) ?? [];
  for (const raw of tags) {
    const name = raw.replace(/[<\/\s]/g, "").toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return null;
  }

  return { svg: s, width, height };
}
