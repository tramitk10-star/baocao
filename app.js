// Dashboard báo cáo page: chọn khoảng thời gian (hôm nay / 7 ngày / 30 ngày / tháng này / tùy chọn).
// Cách cộng dồn không trùng: mỗi báo cáo sáng ngày D phủ 9h D-1 -> 9h D; cộng các báo cáo sáng trong khoảng,
// thêm báo cáo chiều của ngày cuối nếu đó là lần đọc mới nhất (chưa có báo cáo sáng hôm sau).
const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('vi-VN');
const num = (v) => nf.format(v);
const compact = (v) => Math.abs(v) >= 10000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : num(v);
const signed = (v) => (v > 0 ? '+' : '') + compact(v);
const ord = (r) => r.date + (r.slot === 'sang' ? '0' : '1');
const colors = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map((c) => `var(${c})`);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
let all = [], owners = [], latest = null, st = { sort: 'new_videos', dir: -1 };
const colorOf = (o) => colors[owners.indexOf(o) % colors.length];

// Các lần đọc được tính cho khoảng [from, to]
function runsIn(from, to) {
  const runs = [...new Map(all.map((r) => [r.run, r])).values()];
  const pick = runs.filter((r) => r.slot === 'sang' && r.date >= from && r.date <= to && all.some((x) => x.run === r.run && x.new_videos != null));
  if (latest && latest.slot === 'chieu' && latest.date >= from && latest.date <= to) pick.push(latest);
  return pick.map((r) => r.run);
}

function range() {
  const p = $('period').value, last = latest ? latest.date : iso(new Date());
  $('custom').hidden = p !== 'custom';
  if (p === 'today') return [last, last];
  if (p === '7d') return [addDays(last, -6), last];
  if (p === '30d') return [addDays(last, -29), last];
  if (p === 'month') return [last.slice(0, 8) + '01', last];
  return [$('from').value || last, $('to').value || last];
}

function load() {
  fetch('data.json?t=' + Date.now()).then((r) => r.json()).then((data) => {
    all = data;
    owners = [...new Set(all.map((r) => r.owner))].sort();
    latest = [...all].sort((a, b) => ord(b).localeCompare(ord(a)))[0] || null;
    const dates = [...new Set(all.map((r) => r.date))].sort();
    ['from', 'to'].forEach((id) => { $(id).min = dates[0]; $(id).max = dates[dates.length - 1]; });
    if (!$('from').value) $('from').value = addDays(latest.date, -6);
    if (!$('to').value) $('to').value = latest.date;
    const fo = $('f-owner'), ko = fo.value;
    fo.replaceChildren(new Option('Tất cả mọi người', ''), ...owners.map((o) => new Option(o, o)));
    fo.value = ko;
    $('updated').textContent = 'Lần đọc mới nhất: ' + latest.label;
    render();
  }).catch(() => { $('sub').textContent = 'Không tải được số liệu. Thử tải lại trang sau ít phút.'; });
}

function render() {
  if (!latest) return;
  let [from, to] = range();
  if (from > to) [from, to] = [to, from];
  const runIds = runsIn(from, to), set = new Set(runIds);
  const rs = all.filter((r) => set.has(r.run));
  const vids = rs.reduce((s, r) => s + (r.new_videos || 0), 0), gain = rs.reduce((s, r) => s + (r.view_gain || 0), 0);
  // Trung bình/ngày chỉ tính từ ngày đầu tiên có số liệu trong khoảng
  const effFrom = rs.length ? rs.map((r) => r.date).sort()[0] : from;
  const days = Math.round((new Date(to) - new Date(effFrom)) / 864e5) + 1;
  const span = from === to ? 'ngày ' + ddmm(from) : ddmm(from) + ' – ' + ddmm(to);
  const by = owners.map((o) => {
    const mine = rs.filter((r) => r.owner === o);
    return { owner: o, v: mine.reduce((s, r) => s + (r.new_videos || 0), 0), g: mine.reduce((s, r) => s + (r.view_gain || 0), 0) };
  }).sort((a, b) => b.v - a.v);

  const sub = $('sub'); sub.replaceChildren();
  if (rs.length) sub.append('Từ ', el('b', '', span), ': cả nhóm up ', el('b', '', num(vids)), ' video mới, view tăng ', el('b', '', signed(gain)), '.');
  else sub.append('Chưa có số liệu so sánh cho ', el('b', '', span), '.');
  $('t-vids').textContent = rs.length ? num(vids) : '—';
  $('t-vids-n').textContent = days > 1 && rs.length ? 'Trung bình ' + num(Math.round(vids / days * 10) / 10) + ' video/ngày' : 'Reel chưa có ở lần đọc trước';
  $('t-gain').textContent = rs.length ? signed(gain) : '—';
  $('t-top').textContent = rs.length && by[0].v ? by[0].owner : '—';
  $('t-topn').textContent = rs.length && by[0].v ? num(by[0].v) + ' video' : 'Chưa có video mới';
  const lastRs = all.filter((r) => r.run === latest.run);
  $('t-ok').textContent = num(lastRs.filter((r) => r.ok).length);
  $('t-all').textContent = 'trên ' + num(lastRs.length) + ' page, lần đọc ' + latest.label;

  const max = Math.max(1, ...by.map((b) => b.v));
  $('owners').replaceChildren(...by.map((b, i) => {
    const row = el('div', 'bar'); row.append(el('span', '', b.owner));
    const tr = el('div', 'track'); const f = el('div', 'fill' + (i === 0 && b.v ? ' top' : ''));
    f.style.width = (b.v / max * 100) + '%';
    tr.append(f, el('span', 'val', `${num(b.v)} video · ${signed(b.g)} view`));
    row.append(tr); return row;
  }));

  // Biểu đồ theo ngày; khoảng dài hơn 45 ngày thì gộp theo tuần
  $('legend').replaceChildren(...owners.map((o) => { const s = el('span'); const i = el('i'); i.style.background = colorOf(o); s.append(i, o); return s; }));
  const weekly = days > 45;
  const bucketOf = (r) => {
    if (!weekly) return r.date;
    const d = new Date(r.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d);
  };
  const buckets = [...new Set(rs.map(bucketOf))].sort();
  $('hist-note').textContent = weekly ? 'Mỗi cột là một tuần (bắt đầu thứ Hai), chia màu theo người.' : 'Mỗi cột là một ngày báo cáo, chia màu theo người.';
  const totals = buckets.map((b) => rs.filter((r) => bucketOf(r) === b).reduce((s, r) => s + (r.new_videos || 0), 0));
  const hmax = Math.max(1, ...totals);
  $('hist').replaceChildren(...(buckets.length ? buckets.map((b, i) => {
    const c = el('div', 'col'); const stack = el('div', 'stack');
    stack.style.height = (totals[i] / hmax * 150) + 'px';
    const label = (weekly ? 'Tuần ' : '') + ddmm(b);
    const tip = [label + ': ' + num(totals[i]) + ' video'];
    owners.forEach((o) => {
      const v = rs.filter((r) => bucketOf(r) === b && r.owner === o).reduce((s, r) => s + (r.new_videos || 0), 0);
      if (!v) return; tip.push(o + ': ' + num(v));
      const seg = el('i'); seg.style.background = colorOf(o); seg.style.height = (v / totals[i] * 100) + '%'; stack.append(seg);
    });
    c.title = tip.join('\n');
    c.append(el('span', 'n', num(totals[i])), stack, el('span', 'l', label));
    return c;
  }) : [el('p', 'note', 'Chưa có số liệu trong khoảng này.')]));

  // Bảng từng page: cộng dồn trong khoảng; tổng view và số reel lấy ở lần đọc cuối của khoảng
  const lastRun = rs.reduce((a, r) => (!a || ord(r) > ord(a) ? r : a), null);
  const pages = [...new Set(all.map((r) => r.key))].map((k) => {
    const mine = rs.filter((r) => r.key === k), end = lastRun ? all.find((r) => r.key === k && r.run === lastRun.run) : null;
    const any = end || all.find((r) => r.key === k);
    return { page: any.page, url: any.url, owner: any.owner, platform: any.platform, ok: end ? end.ok : 1,
      new_videos: mine.length ? mine.reduce((s, r) => s + (r.new_videos || 0), 0) : null,
      view_gain: mine.length ? mine.reduce((s, r) => s + (r.view_gain || 0), 0) : null,
      views: end ? end.views : 0, reels: end ? end.reels : 0 };
  });
  const fo = $('f-owner').value, fp = $('f-plat').value;
  const rows = pages.filter((r) => (!fo || r.owner === fo) && (!fp || r.platform === fp)).sort((a, b) => {
    const va = a[st.sort], vb = b[st.sort];
    if (typeof va === 'number' || typeof vb === 'number' || va == null) return st.dir * ((va ?? -1e15) - (vb ?? -1e15));
    return st.dir * String(va).localeCompare(String(vb), 'vi');
  });
  $('rows').replaceChildren(...rows.map((r) => {
    const tr = el('tr');
    const a = el('a', '', r.page); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.style.color = 'inherit';
    const c0 = el('td'); c0.append(a); tr.append(c0, el('td', '', r.owner));
    const cp = el('td', 'narrow-hide'); cp.append(el('span', 'pill', r.platform)); tr.append(cp);
    if (!r.ok) tr.append(el('td', 'num bad', 'Không đọc được'), el('td', 'num zero', '—'));
    else tr.append(el('td', 'num ' + (r.new_videos ? 'up' : 'zero'), r.new_videos == null ? '—' : num(r.new_videos)),
                   el('td', 'num ' + (r.view_gain ? '' : 'zero'), r.view_gain == null ? '—' : signed(r.view_gain)));
    return tr;
  }));
}

['period', 'from', 'to', 'f-owner', 'f-plat'].forEach((id) => $(id).addEventListener('change', render));
document.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.k; st.dir = st.sort === k ? -st.dir : (['page', 'owner', 'platform'].includes(k) ? 1 : -1); st.sort = k;
  document.querySelectorAll('th').forEach((th) => th.removeAttribute('aria-sort'));
  b.parentElement.setAttribute('aria-sort', st.dir > 0 ? 'ascending' : 'descending'); render();
}));
load();
setInterval(load, 10 * 60 * 1000);
