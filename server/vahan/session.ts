// One JSF conversation with the Vahan report page: keeps cookies, the ViewState token
// and the form values, and replays the same requests the page's own widgets send.
import { decodeEntities, readAllSelects, readCheckboxes, readErrors, CHECK_GROUP_NAMES } from './html.ts';

const ORIGIN = 'https://vahan.parivahan.gov.in';
const PAGE = '/vahan4dashboard/vahan/view/reportview.xhtml';
const FORM = 'masterLayout_formlogin';
const TIMEOUT_MS = 60_000;

export class UpstreamError extends Error {}
export class ValidationError extends Error {}

export interface PartialResponse {
  updates: Map<string, string>;
}

type FormValue = string | string[];

export class JsfSession {
  readonly html: string;
  readonly ids: { unit: string; state: string; refresh: string; sideRefresh: string };
  /** Current form values, kept in step with what the page would submit. */
  readonly form = new Map<string, FormValue>();
  private cookies: string;
  private viewState: string;

  private constructor(html: string, cookies: string) {
    this.html = html;
    this.cookies = cookies;
    const vs = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
    if (!vs) throw new UpstreamError('Vahan page did not include a ViewState');
    this.viewState = decodeEntities(vs[1]);

    // Some component ids are auto-generated (j_idtNN), so find them by what they contain.
    const selects = readAllSelects(html);
    const findSelect = (pattern: RegExp) => [...selects].find(([, s]) => s.options.some((o) => pattern.test(o.label)))?.[0];
    const unit = findSelect(/^In Thousand$/);
    const state = findSelect(/^All Vahan4 Running States/);
    const refresh = html.match(/<button id="([^"]+)"[^>]*onclick="[^"]*VhCatg/)?.[1];
    const sideRefresh = html.match(/id="filterLayout"[\s\S]*?<button id="([^"]+)"/)?.[1];
    if (!unit || !state || !refresh || !sideRefresh) throw new UpstreamError('Vahan page layout has changed');
    this.ids = { unit: unit.replace(/_input$/, ''), state: state.replace(/_input$/, ''), refresh, sideRefresh };

    this.form.set(FORM, FORM);
    for (const [id, s] of selects) this.form.set(id, s.selected);
    this.form.set(`${this.ids.unit}_input`, 'A'); // always fetch actual values; the client scales them
  }

  static async open(): Promise<JsfSession> {
    const res = await fetch(ORIGIN + PAGE, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new UpstreamError(`Vahan page returned HTTP ${res.status}`);
    const cookies = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return new JsfSession(await res.text(), cookies);
  }

  get(field: string): FormValue | undefined {
    return this.form.get(field);
  }

  set(field: string, value: FormValue) {
    this.form.set(field, value);
  }

  /** Fires a widget's "change" behaviour (process the widget, re-render `render`). */
  change(componentId: string, render: string): Promise<PartialResponse> {
    return this.ajax({
      'javax.faces.source': componentId,
      'javax.faces.partial.execute': componentId,
      'javax.faces.partial.render': render,
      'javax.faces.behavior.event': 'change',
      'javax.faces.partial.event': 'change',
    });
  }

  /** Presses a command button (processes the whole page, re-renders `render`). */
  press(buttonId: string, render: string): Promise<PartialResponse> {
    return this.ajax({
      'javax.faces.source': buttonId,
      'javax.faces.partial.execute': '@all',
      'javax.faces.partial.render': render,
      [buttonId]: buttonId,
    });
  }

  /** Triggers the table's Excel export link and returns the .xlsx bytes. */
  async exportXlsx(tableId: string): Promise<Uint8Array> {
    const link = `${tableId}:xls`;
    const res = await this.post({ [link]: link }, false);
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('spreadsheetml')) throw new UpstreamError('Vahan did not return an Excel export');
    return new Uint8Array(await res.arrayBuffer());
  }

  private async ajax(params: Record<string, string>): Promise<PartialResponse> {
    const res = await this.post({ 'javax.faces.partial.ajax': 'true', ...params }, true);
    const xml = await res.text();
    if (!res.ok) throw new UpstreamError(`Vahan returned HTTP ${res.status}`);
    const error = xml.match(/<error-message><!\[CDATA\[([\s\S]*?)\]\]><\/error-message>/);
    if (error || xml.includes('<error>')) throw new UpstreamError(`Vahan error: ${error?.[1] ?? 'unknown'}`);
    if (xml.includes('ViewExpiredException')) throw new UpstreamError('Vahan session expired');

    const updates = new Map<string, string>();
    for (const m of xml.matchAll(/<update id="([^"]+)"><!\[CDATA\[([\s\S]*?)\]\]><\/update>/g)) updates.set(m[1], m[2]);
    for (const [id, html] of updates) {
      if (id.includes('javax.faces.ViewState')) this.viewState = html;
      else this.sync(html);
    }
    const errors = [...updates.values()].flatMap(readErrors);
    if (errors.length) throw new ValidationError(errors.join('; '));
    return { updates };
  }

  /** After a fragment is re-rendered, take its selects/checkboxes as the browser would. */
  private sync(html: string) {
    for (const [id, s] of readAllSelects(html)) {
      if (id === `${this.ids.unit}_input`) continue;
      this.form.set(id, s.selected);
    }
    for (const name of [...CHECK_GROUP_NAMES, 'yearList']) {
      if (html.includes(`name="${name}"`)) this.form.set(name, readCheckboxes(html, name).checked);
    }
  }

  private async post(extra: Record<string, string>, ajax: boolean): Promise<Response> {
    const body = new URLSearchParams();
    for (const [k, v] of this.form) {
      if (Array.isArray(v)) v.forEach((x) => body.append(k, x));
      else body.append(k, v);
    }
    for (const [k, v] of Object.entries(extra)) body.set(k, v);
    body.set('javax.faces.ViewState', this.viewState);

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Cookie: this.cookies,
    };
    if (ajax) Object.assign(headers, { 'Faces-Request': 'partial/ajax', 'X-Requested-With': 'XMLHttpRequest' });
    return fetch(ORIGIN + PAGE, { method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
}
