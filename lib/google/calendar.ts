import { getGoogleOAuthConfig } from "@/lib/google/config";

/**
 * Google Calendar REST API の薄いラッパー（依存追加なし・raw fetch）。
 *
 * 使う側（Route Handler）は各ユーザーの refresh token を `google_credentials` から
 * 引いて `getAccessToken()` に渡し、返ってきた access token で
 * `createCalendarEvent()` / `deleteCalendarEvent()` を呼ぶ。
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * refresh token が失効している（ユーザーが連携解除した等）。
 * 呼び出し側はこれを「再ログインが必要」と判定してレスポンスに載せる。
 */
export class GoogleAuthError extends Error {
  constructor(message = "Google の再連携が必要です。") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** refresh token を access token に交換する。 */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      throw new GoogleAuthError();
    }
    throw new Error(
      `Google トークン取得に失敗しました: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim(),
    );
  }

  return data.access_token;
}

export interface CalendarEventInput {
  summary: string;
  location?: string | null;
  description?: string;
  /** オフセット付き ISO 文字列（timestamptz をそのまま渡してよい）。 */
  startISO: string;
  endISO: string;
}

/** primary カレンダーにイベントを作成し、Google 側のイベント ID を返す。 */
export async function createCalendarEvent(
  accessToken: string,
  input: CalendarEventInput,
): Promise<string> {
  const res = await fetch(CALENDAR_EVENTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      location: input.location ?? undefined,
      description: input.description,
      start: { dateTime: input.startISO },
      end: { dateTime: input.endISO },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    if (res.status === 401) throw new GoogleAuthError();
    throw new Error(
      `カレンダーイベントの作成に失敗しました: ${data.error?.message ?? res.status}`,
    );
  }

  return data.id;
}

/**
 * primary カレンダーからイベントを削除する。
 * 既に存在しない（410）場合も成功扱いにする（冪等）。
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (res.status === 204 || res.status === 404 || res.status === 410) return;
  if (res.status === 401) throw new GoogleAuthError();

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  throw new Error(
    `カレンダーイベントの削除に失敗しました: ${data.error?.message ?? res.status}`,
  );
}
