"use client";

import DOMPurify from "dompurify";
import katex from "katex";
import type { Figure as FigureData } from "@/lib/gemini/schema";

/**
 * 問題文に添える図。
 *
 * SVG は図形・線・軸のみ。文字・数式ラベルは `figure.labels` を KaTeX で描画し、
 * SVG の上に viewBox 座標に合わせて絶対配置で重ねる（SVG の <text> は使わない）。
 *
 * サーバー側で `validateSvg` を通しているが、DOM 挿入の直前にもう一度 DOMPurify に通す。
 * `dangerouslySetInnerHTML` に渡してよいのはサニタイズ済みの文字列だけ。
 */
export function Figure({
  figure,
  index,
}: {
  figure: FigureData;
  index: number;
}) {
  const clean = DOMPurify.sanitize(figure.svg, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ["script", "style", "foreignObject", "image", "use", "a", "text"],
    FORBID_ATTR: ["href", "xlink:href"],
  });

  if (!clean.trim()) return null;

  const { width, height, labels = [] } = figure;

  return (
    <figure
      className="figure"
      role="img"
      aria-label={figure.caption ?? `図 ${index}`}
    >
      <div
        className="figure-canvas"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <div
          className="figure-body"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
        {labels.map((label, i) => {
          const anchor = label.anchor ?? "middle";
          const tx =
            anchor === "start" ? "0" : anchor === "end" ? "-100%" : "-50%";
          let html: string;
          try {
            html = katex.renderToString(label.tex, {
              throwOnError: false,
              output: "html",
            });
          } catch {
            return null;
          }
          return (
            <span
              key={i}
              className="figure-label"
              style={{
                left: `${(label.x / width) * 100}%`,
                top: `${(label.y / height) * 100}%`,
                transform: `translate(${tx}, -50%)`,
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })}
      </div>
      <figcaption className="mt-1 text-center text-xs text-zinc-600">
        図 {index}
        {figure.caption ? `　${figure.caption}` : ""}
      </figcaption>
    </figure>
  );
}
