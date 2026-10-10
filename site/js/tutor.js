// The case-study tutor: a small chat beside the map. Messages go to
// play.causalblocks.com/api/tutor, which asks the model. The model never
// invents a number: for "what if…" it calls try_map, and the page answers
// with a real estimate (see case-studies.js).

const ENDPOINT = (() => {
  // A local test server can stand in for the real one, on a local page only.
  const override = new URL(location.href).searchParams.get("tutor");
  if (override && ["localhost", "127.0.0.1"].includes(location.hostname)) return override;
  return "https://play.causalblocks.com/api/tutor";
})();
const MAX_TOOL_ROUNDS = 3;
const MAX_TURNS = 30; // messages kept; older ones drop off

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Plain text with **bold** and line breaks, nothing else.
const format = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

/**
 * @param root        the element to build the tutor in
 * @param context()   the case study, as text for the model
 * @param tryMap(args) runs a map the model asked for; returns a plain object
 *                    for the model, and `card` (HTML) to show in the chat
 */
export function createTutor(root, { context, tryMap }) {
  root.innerHTML = `
    <div class="tutor-log" aria-live="polite"></div>
    <div class="tutor-chips"></div>
    <form class="tutor-form">
      <label class="visually-hidden" for="tutor-input">Ask the tutor</label>
      <input id="tutor-input" type="text" maxlength="1000" autocomplete="off" placeholder="Ask why, or try a what if…">
      <button type="submit">Ask</button>
    </form>
    <p class="tutor-note">An AI tutor: it can get things wrong, but its numbers come from the real data.
      Don't share personal information. Chats aren't stored.</p>`;
  const log = root.querySelector(".tutor-log");
  const chips = root.querySelector(".tutor-chips");
  const form = root.querySelector("form");
  const input = root.querySelector("input");
  let messages = [];
  let busy = false;

  function add(cls, html) {
    const div = document.createElement("div");
    div.className = `tutor-msg ${cls}`;
    div.innerHTML = html;
    log.append(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function reset() {
    messages = [];
    log.innerHTML = "";
    add("from-tutor", "Hi! Ask me why a map gets its answer, or try a <b>what if</b>: I'll draw your map and run it on the real data.");
  }

  async function call() {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: context(), messages: messages.slice(-MAX_TURNS) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.message) throw new Error(data.error ?? "The tutor had a problem. Try again in a moment.");
    return data.message;
  }

  async function ask(text) {
    if (busy || !text.trim()) return;
    busy = true;
    form.classList.add("busy");
    add("from-you", escapeHtml(text));
    const before = messages.length;
    messages.push({ role: "user", content: text });
    const thinking = add("from-tutor thinking", "<span></span><span></span><span></span>");
    try {
      for (let round = 0; ; round++) {
        const msg = await call();
        messages.push(msg);
        if (!msg.tool_calls?.length || round >= MAX_TOOL_ROUNDS) {
          thinking.remove();
          add("from-tutor", format(msg.content || "Sorry, I lost my train of thought. Could you ask that again?"));
          break;
        }
        for (const c of msg.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(c.function?.arguments || "{}");
          } catch { /* answered as an error below */ }
          const { result, card } = tryMap(args);
          if (card) log.insertBefore(Object.assign(document.createElement("div"), { className: "tutor-msg map-card", innerHTML: card }), thinking);
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
        }
      }
    } catch (err) {
      thinking.remove();
      add("from-tutor error", escapeHtml(err.message || "The tutor couldn't be reached. Try again in a moment."));
      messages.length = before; // forget the failed exchange, so they can ask again
    } finally {
      busy = false;
      form.classList.remove("busy");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    ask(text);
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) ask(b.textContent);
  });

  reset();
  return {
    reset,
    suggest(questions) {
      chips.innerHTML = questions.map((q) => `<button type="button">${escapeHtml(q)}</button>`).join("");
    },
  };
}
