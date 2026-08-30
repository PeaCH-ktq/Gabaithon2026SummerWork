export interface QuestionPromptOptions {
  /** 追加の指示（範囲の限定など、任意）。 */
  extraInstruction?: string;
}

/**
 * 講義資料または過去問（1ファイル）から問題を作るプロンプトを組み立てる。
 *
 * - 添付が講義資料か過去問かは Gemini が中身から判断する
 *   - 講義資料と判断 → 資料の内容から出題（資料に無い事項は出さない）
 *   - 過去問と判断   → 傾向・形式・難易度を分析し、そっくりな類似問題を新規作成
 * - 問題数・難易度・出題形式は資料の分量と内容から Gemini が適切に決める
 */
export function buildQuestionPrompt(opts: QuestionPromptOptions = {}): string {
  return [
    `あなたは大学の講義内容から試験対策問題を作る出題者です。`,
    `添付ファイルは「講義資料」または「過去問」のどちらかです。まず中身を見てどちらか判断してください。`,
    ``,
    `- 講義資料だと判断した場合: 資料に書かれている内容だけに基づいて問題を作成する。資料に無い事項を推測で出題しない。`,
    `- 過去問だと判断した場合: 出題範囲・傾向・形式・難易度・問い方を分析し、それにそっくりな類似問題を新しく作成する。設問をそのまま流用せず、数値・題材・観点を変える。`,
    ``,
    `日本語で作成してください。`,
    `問題数・難易度・出題形式（選択式 / 短答式 / 記述式）は、資料の分量と内容から適切に判断してください（目安: 5〜10問）。`,
    `選択式にする場合は、選択肢を問題文の本文に「ア. … イ. … ウ. …」の形式で含めてください。`,
    `各問題には自習用の解答(answer)と簡潔な解説(explanation)を付けてください。`,
    ``,
    `数式・数式記号は、選択肢や解答の中も含めて、必ず LaTeX 記法で $...$（独立行は $$...$$）で囲んでください。`,
    `LaTeX コマンド（\\frac, \\lim, \\{ など）を $ の外に裸で書かないこと。`,
    `数式以外の文脈で $ 記号を使う場合は \\$ とエスケープしてください。`,
    ``,
    `【図の作成ルール】`,
    `- 図（幾何・グラフ・回路・フローチャート等）が無いと成立しない問題にのみ、figure フィールドを付ける。装飾目的では付けない。`,
    `- 図の中に答えを描かない（作図の解答線、グラフの答えの曲線などを描かない）。`,
    `- figure.svg はインライン SVG。ルートは <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">。`,
    `  - viewBox は必須。W, H は 100〜800 の整数。width / height 属性は書かない。`,
    `  - 使ってよい要素: svg, g, defs, marker, path, line, polyline, polygon, rect, circle, ellipse, title, desc`,
    `  - 使用禁止: script, style, foreignObject, image, use, a, iframe, animate 系, set`,
    `  - href / xlink:href / on* 属性は禁止。url(...) は url(#id) の内部参照のみ。`,
    `- 【重要】文字・数式は SVG の <text> に書かない。すべて figure.labels 配列に入れる。`,
    `  - 各ラベルは { x, y, tex, anchor } 。x, y は viewBox 座標系での位置。`,
    `  - tex には LaTeX を書く（例: "x^2", "y = x^2", "\\frac{1}{2}", "\\int_0^2 x^2\\,dx"）。`,
    `  - 日本語や単なる文字列は \\text{...} で囲む（例: "\\text{原点}"）。`,
    `  - anchor は "start" / "middle"（既定）/ "end"。`,
    `- 白黒印刷前提: 線は stroke="black"、面は fill="none" か fill="white"、網掛けは #666 まで。stroke-width は 1〜2。`,
    `- SVG 全体で 8000 文字以内。`,
    opts.extraInstruction ? `\n追加の指示: ${opts.extraInstruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
