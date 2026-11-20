(function () {
  const listenerKey = "__westsideReminderListener";
  const contentVersion = "2";
  const previousListener = window[listenerKey];
  if (typeof previousListener === "function") {
    chrome.runtime.onMessage.removeListener(previousListener);
  }

  const hostId = "westside-reminder-overlay";
  let dismissTimer;
  let host;
  let shadow;

  function ensureUi() {
    if (host?.dataset.westsideVersion === contentVersion) return;
    host?.remove();

    host = document.createElement("div");
    host.id = hostId;
    host.dataset.westsideVersion = contentVersion;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    (document.body || document.documentElement).appendChild(host);

    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        [hidden] { display: none !important; }
        #toast {
          box-sizing: border-box;
          position: fixed;
          right: 20px;
          bottom: 20px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          width: min(390px, calc(100vw - 40px));
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          color: #172033;
          box-shadow: 0 12px 36px rgba(20, 32, 54, 0.2);
          font: 14px/1.5 system-ui, sans-serif;
          pointer-events: auto;
        }
        #mark {
          display: grid;
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          place-items: center;
          border-radius: 10px;
          background: #e8f8fc;
          color: #1689a8;
          font-weight: 800;
        }
        #content { flex: 1; min-width: 0; }
        #title { margin: 0 0 3px; font-size: 15px; font-weight: 700; }
        #message { margin: 0; color: #596579; overflow-wrap: anywhere; }
        #actions { display: flex; flex: 0 0 auto; gap: 6px; align-items: center; }
        button { cursor: pointer; font-family: inherit; }
        #okay {
          padding: 6px 10px;
          border: 0;
          border-radius: 8px;
          background: #1689a8;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
        }
        #close {
          padding: 3px 6px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #758096;
          font-size: 20px;
          line-height: 1;
        }
        #close:hover { background: #f1f3f6; color: #172033; }
        #backdrop {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.55);
          pointer-events: auto;
        }
        #dialog {
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          width: min(560px, calc(100vw - 32px));
          max-height: min(84vh, 720px);
          overflow: hidden;
          border: 1px solid #e6eaf0;
          border-radius: 18px;
          background: #ffffff;
          color: #172033;
          box-shadow: 0 24px 70px rgba(10, 20, 40, 0.28);
          font: 14px/1.55 system-ui, sans-serif;
        }
        #dialog-header { padding: 22px 24px 14px; }
        #eyebrow {
          margin: 0 0 5px;
          color: #1689a8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        #dialog-title { margin: 0; font-size: 21px; line-height: 1.3; }
        #intro { margin: 7px 0 0; color: #697386; }
        #exercises {
          display: grid;
          gap: 10px;
          overflow: auto;
          padding: 0 24px 8px;
        }
        .exercise {
          padding: 12px 14px;
          border: 1px solid #e8edf2;
          border-radius: 12px;
          background: #f8fafc;
        }
        .exercise-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
        }
        .exercise h3 { margin: 0; font-size: 14px; }
        .duration { flex: 0 0 auto; color: #1689a8; font-size: 12px; font-weight: 700; }
        .exercise p { margin: 5px 0 0; color: #596579; }
        #caution { margin: 10px 24px 0; color: #758096; font-size: 12px; }
        #dialog-footer {
          display: flex;
          justify-content: flex-end;
          padding: 16px 24px 20px;
        }
        #confirm {
          min-width: 84px;
          padding: 9px 18px;
          border: 0;
          border-radius: 9px;
          background: #1689a8;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
        }
        #confirm:hover, #okay:hover { filter: brightness(0.94); }
        @media (max-width: 480px) {
          #dialog-header { padding: 18px 18px 12px; }
          #exercises { padding-right: 18px; padding-left: 18px; }
          #caution { margin-right: 18px; margin-left: 18px; }
          #dialog-footer { padding: 14px 18px 18px; }
          #dialog-title { font-size: 19px; }
        }
      </style>
      <section id="toast" role="alert" aria-live="assertive" hidden>
        <div id="mark" aria-hidden="true">W</div>
        <div id="content">
          <h2 id="title"></h2>
          <p id="message"></p>
        </div>
        <div id="actions">
          <button id="okay" type="button" hidden>好的</button>
          <button id="close" type="button" aria-label="关闭提醒">×</button>
        </div>
      </section>
      <div id="modal" hidden>
        <div id="backdrop">
          <section id="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <header id="dialog-header">
              <p id="eyebrow">STRETCH BREAK</p>
              <h2 id="dialog-title">久坐拉伸跟练</h2>
              <p id="intro">选几个动作慢慢活动，保持自然呼吸，不需要勉强拉伸。</p>
            </header>
            <div id="exercises">
              <article class="exercise">
                <div class="exercise-heading">
                  <h3>肩颈侧屈</h3>
                  <span class="duration">20 秒 / 侧</span>
                </div>
                <p>坐直或站直，肩膀放松，将耳朵轻轻靠向一侧肩膀，再换边；不要用手压头。</p>
              </article>
              <article class="exercise">
                <div class="exercise-heading">
                  <h3>胸部打开</h3>
                  <span class="duration">20 秒</span>
                </div>
                <p>站立，双手轻扶腰侧，肩膀轻轻向后下方放松，打开胸口并自然呼吸。</p>
              </article>
              <article class="exercise">
                <div class="exercise-heading">
                  <h3>坐姿躯干转体</h3>
                  <span class="duration">15 秒 / 侧</span>
                </div>
                <p>双脚平放地面，坐稳后缓慢转向一侧，手轻扶椅背辅助，再换边；不要扭到疼痛。</p>
              </article>
              <article class="exercise">
                <div class="exercise-heading">
                  <h3>站姿髋前侧伸展</h3>
                  <span class="duration">20 秒 / 侧</span>
                </div>
                <p>前后分腿站立并扶稳桌沿，后脚跟抬起，身体重心轻轻前移，感受后侧髋部前方伸展，再换边。</p>
              </article>
            </div>
            <p id="caution">如有疼痛或不适，请立即停止并选择舒适的动作。</p>
            <footer id="dialog-footer">
              <button id="confirm" type="button">确认</button>
            </footer>
          </section>
        </div>
      </div>
    `;

    shadow.getElementById("close").addEventListener("click", dismissToast);
    shadow.getElementById("okay").addEventListener("click", showStretchGuide);
    shadow.getElementById("confirm").addEventListener("click", closeStretchGuide);
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !shadow.getElementById("modal").hidden) {
        closeStretchGuide();
      }
    });
  }

  function dismissToast() {
    window.clearTimeout(dismissTimer);
    if (shadow) shadow.getElementById("toast").hidden = true;
  }

  function showStretchGuide() {
    dismissToast();
    const modal = shadow.getElementById("modal");
    modal.hidden = false;
    shadow.getElementById("confirm").focus();
  }

  function closeStretchGuide() {
    shadow.getElementById("modal").hidden = true;
  }

  function showReminder(reminderId, title, message) {
    ensureUi();
    shadow.getElementById("title").textContent = title;
    shadow.getElementById("message").textContent = message;
    shadow.getElementById("okay").hidden = reminderId !== "stand";
    shadow.getElementById("toast").hidden = false;
    window.clearTimeout(dismissTimer);
    dismissTimer = window.setTimeout(dismissToast, 8000);
  }

  const listener = (request, _sender, sendResponse) => {
    if (request?.type === "SHOW_STRETCH_GUIDE") {
      ensureUi();
      showStretchGuide();
      sendResponse({ ok: true });
      return;
    }

    if (
      !request ||
      request.type !== "SHOW_TAB_REMINDER" ||
      typeof request.reminderId !== "string" ||
      typeof request.title !== "string" ||
      typeof request.message !== "string"
    ) {
      return;
    }

    showReminder(request.reminderId, request.title, request.message);
    sendResponse({ ok: true });
  };

  window[listenerKey] = listener;
  chrome.runtime.onMessage.addListener(listener);
})();
