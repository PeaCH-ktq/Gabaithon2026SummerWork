import { Type, type Schema } from "@google/genai";

/**
 * 生成される問題データの型。`lib/gemini/*` とフロントで共有する唯一の定義源。
 * `responseSchema`（下）と構造を一致させること。
 *
 * このアプリは「問題を生成する」だけで採点はしない。`answer` / `explanation` は
 * 問題集に添える解答欄（印刷・自習用）であり、ユーザー入力の正誤判定には使わない。
 *
 * 出題形式（選択式 / 記述式など）は Gemini が資料に応じて自動で決める。選択式にする
 * 場合は選択肢を `prompt` 本文（例: `ア. … イ. …`）に含める。数式は LaTeX 記法で書く。
 */
/** 図中のラベル。数式は KaTeX で描画し、SVG の上に重ねる。 */
export interface FigureLabel {
  /** viewBox 座標系での位置。 */
  x: number;
  y: number;
  /** ラベルの内容。LaTeX（例: `x^2`, `\frac{a}{b}`）。日本語は `\text{...}` で囲む。 */
  tex: string;
  /** 水平アンカー。既定は "middle"。 */
  anchor?: "start" | "middle" | "end";
}

/** 問題文に添える図。 */
export interface Figure {
  /** インライン SVG マークアップ（図形・線・軸のみ）。サニタイズを通したものだけが入る。 */
  svg: string;
  /** viewBox の幅・高さ。ラベル overlay の座標変換に使う（サーバー側で svg から補完）。 */
  width: number;
  height: number;
  /** 図中のラベル（数式は KaTeX で描画し SVG の上に重ねる）。 */
  labels?: FigureLabel[];
  /** 図の説明。「図 N」の後ろに表示し、aria-label にも使う。 */
  caption?: string;
}

export interface Question {
  /** 問題文。選択肢を含む場合もある。数式は LaTeX（`$...$` / `$$...$$`）。 */
  prompt: string;
  /** 図が無いと解けない問題にのみ付く。 */
  figure?: Figure;
  /** 解答欄（自習用）。数式は LaTeX。 */
  answer?: string;
  /** 解説（自習用）。数式は LaTeX。 */
  explanation?: string;
}

export interface QuestionSet {
  /** 資料から推定した科目・単元名。 */
  title: string;
  questions: Question[];
}

/**
 * Gemini の構造化出力用スキーマ。`responseMimeType: "application/json"` と併用する。
 */
export const questionSetResponseSchema: Schema = {
  type: Type.OBJECT,
  required: ["title", "questions"],
  properties: {
    title: { type: Type.STRING, description: "資料から推定した科目・単元名" },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["prompt"],
        properties: {
          prompt: {
            type: Type.STRING,
            description:
              "問題文。選択式なら選択肢も本文に含める。数式は LaTeX（インライン $...$、独立行 $$...$$）",
          },
          figure: {
            type: Type.OBJECT,
            description:
              "図が無いと解けない問題にのみ付ける。不要なら省略する",
            properties: {
              svg: {
                type: Type.STRING,
                description:
                  "インライン SVG。図形・線・軸のみ。viewBox 必須、width/height 属性は書かない。文字・数式は <text> に入れず labels で渡す。script/style/foreignObject/image/use/a/href は使わない",
              },
              labels: {
                type: Type.ARRAY,
                description:
                  "図中の文字・数式ラベル。SVG の上に KaTeX で重ねて描画される",
                items: {
                  type: Type.OBJECT,
                  required: ["x", "y", "tex"],
                  properties: {
                    x: { type: Type.NUMBER, description: "viewBox 座標系での x" },
                    y: { type: Type.NUMBER, description: "viewBox 座標系での y" },
                    tex: {
                      type: Type.STRING,
                      description:
                        "LaTeX（例: x^2, \\frac{a}{b}）。日本語は \\text{...} で囲む",
                    },
                    anchor: {
                      type: Type.STRING,
                      format: "enum",
                      enum: ["start", "middle", "end"],
                    },
                  },
                },
              },
              caption: { type: Type.STRING, description: "図の簡潔な説明" },
            },
          },
          answer: {
            type: Type.STRING,
            description: "解答欄（自習用）。数式は LaTeX",
          },
          explanation: {
            type: Type.STRING,
            description: "解説（自習用）。数式は LaTeX",
          },
        },
      },
    },
  },
};

/** Gemini の生テキスト応答をパースする。 */
export function parseQuestionSet(text: string | undefined): QuestionSet {
  if (!text) {
    throw new Error("Gemini から空の応答が返りました。");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Gemini の応答を JSON としてパースできませんでした。");
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as QuestionSet).questions)
  ) {
    throw new Error("Gemini の応答が想定した問題セットの形式ではありません。");
  }

  return data as QuestionSet;
}
