(function () {
  const listenerKey = "__westsideReminderListener";
  const contentVersion = "4";
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
          right: 22px;
          bottom: 22px;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) 88px;
          gap: 16px;
          align-items: center;
          width: min(540px, calc(100vw - 32px));
          min-height: 132px;
          padding: 20px 24px;
          border: 1px solid #5c7548;
          border-radius: 20px;
          background: #20251f;
          color: #e9eee8;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
          font: 14px/1.5 system-ui, sans-serif;
          pointer-events: auto;
        }
        #mark {
          display: grid;
          width: 52px;
          height: 52px;
          place-items: center;
          border-radius: 14px;
          background: #b8ed64;
          color: #141814;
          font: 900 26px "Barlow Condensed", sans-serif;
        }
        #content { flex: 1; min-width: 0; }
        #title { margin: 0 0 6px; font-size: 17px; font-weight: 700; }
        #message { margin: 0; color: #9ca69f; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
        #actions {
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
        }
        button { cursor: pointer; font-family: inherit; }
        #okay {
          min-width: 88px;
          height: 44px;
          padding: 0 16px;
          border: 0;
          border-radius: 12px;
          background: #b8ed64;
          color: #141814;
          font-size: 15px;
          font-weight: 800;
          transition: 150ms ease;
        }
        #okay:hover { background: #ceff80; transform: translateY(-1px); }
        #close {
          width: 24px;
          height: 24px;
          margin: -5px -5px 0 0;
          display: grid;
          place-items: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: #778079;
          font-size: 24px;
          line-height: 1;
        }
        #close:hover { color: #d3ddd4; }
        #backdrop {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 24px 16px;
          background: rgba(5, 7, 6, 0.78);
          backdrop-filter: blur(7px);
          pointer-events: auto;
        }
        #dialog {
          box-sizing: border-box;
          width: min(620px, 100%);
          max-height: calc(100vh - 32px);
          overflow: auto;
          color: #f1f0e9;
          border: 1px solid #45463c;
          border-radius: 19px;
          background: linear-gradient(140deg, rgba(255, 182, 73, 0.08), transparent 38%), #191c1a;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.65);
          font: 14px/1.5 system-ui, sans-serif;
        }
        #modal-heading {
          padding: 24px 25px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid #30332f;
        }
        #modal-heading p {
          margin: 0 0 5px;
          color: #ffb649;
          font: 700 10px/1 system-ui, sans-serif;
          letter-spacing: 0.18em;
        }
        #stretch-title { margin: 0 0 7px; font-size: 22px; font-weight: 800; }
        #modal-heading span { color: #8c948e; font-size: 11px; }
        #modal-badge {
          width: 50px;
          height: 50px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          color: #ffb649;
          border: 1px solid rgba(255, 182, 73, 0.35);
          border-radius: 13px;
          background: rgba(255, 182, 73, 0.1);
          transform: rotate(3deg);
        }
        #modal-badge svg {
          width: 28px;
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1.7;
        }
        #stretch-grid {
          padding: 18px 20px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .stretch-item {
          min-width: 0;
          padding: 10px;
          display: grid;
          grid-template-columns: 88px 1fr;
          align-items: center;
          gap: 12px;
          border: 1px solid #303430;
          border-radius: 12px;
          background: #1e211f;
        }
        .pose-box {
          position: relative;
          height: 88px;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: #ffb649;
          border-radius: 9px;
          background:
            linear-gradient(rgba(255, 182, 73, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 182, 73, 0.04) 1px, transparent 1px), #171a18;
          background-size: 12px 12px;
        }
        .pose-box > span {
          position: absolute;
          top: 6px;
          left: 7px;
          color: #5e5341;
          font: 800 9px/1 system-ui, sans-serif;
          letter-spacing: 0.08em;
        }
        .pose-box svg {
          width: 72px;
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2.2;
        }
        .pose-box .pose-arrow { stroke: #b8ed64; stroke-dasharray: 2 3; }
        .stretch-copy h3 { margin: 0 0 5px; color: #e9eae4; font-size: 13px; font-weight: 700; }
        .stretch-copy strong {
          display: inline-block;
          margin-bottom: 6px;
          color: #ffb649;
          font-size: 9px;
          font-weight: 700;
        }
        .stretch-copy p { margin: 0; color: #7e8680; font-size: 9px; line-height: 1.5; }
        #modal-note {
          margin: 0 20px 18px;
          padding: 9px 11px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #858e87;
          border: 1px solid #303531;
          border-radius: 8px;
          background: #161917;
          font-size: 9px;
        }
        #modal-note span {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          color: #181a18;
          border-radius: 50%;
          background: #777f79;
          font-size: 10px;
          font-weight: 800;
        }
        #modal-footer {
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #30332f;
          background: #151816;
        }
        #modal-footer p {
          margin: 0;
          color: #444b46;
          font: 900 15px/1 system-ui, sans-serif;
          letter-spacing: 0.08em;
        }
        #confirm {
          min-width: 110px;
          height: 36px;
          padding: 0 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #171a17;
          border: 0;
          border-radius: 8px;
          background: #b8ed64;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 4px 0 #536d34;
          transition: 150ms ease;
        }
        #confirm:hover { background: #ceff80; transform: translateY(-1px); }
        #confirm:active { transform: translateY(2px); box-shadow: 0 2px 0 #536d34; }
        #confirm svg {
          width: 15px;
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2;
        }
        @media (max-width: 480px) {
          #toast {
            right: 16px;
            bottom: 16px;
            min-height: 112px;
            padding: 16px;
            grid-template-columns: 44px minmax(0, 1fr) 72px;
            gap: 10px;
          }
          #mark { width: 44px; height: 44px; font-size: 22px; }
          #title { font-size: 14px; }
          #message { font-size: 12px; }
          #okay { min-width: 72px; height: 40px; }
          #backdrop { padding: 0; }
          #dialog { width: 100%; max-height: 100vh; min-height: 100vh; border: 0; border-radius: 0; }
          #stretch-grid { grid-template-columns: 1fr; }
          #modal-footer { position: sticky; bottom: 0; }
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
          <section id="dialog" role="dialog" aria-modal="true" aria-labelledby="stretch-title">
            <header id="modal-heading">
              <div>
                <p>QUICK RESET · 2 MIN</p>
                <h2 id="stretch-title">起身松一松，G</h2>
                <span>跟着做一轮，把久坐的紧绷留在椅子上。</span>
              </div>
              <div id="modal-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M8.3 21l2.1-6.2-2-3.8m7.3 10-2.2-6.4 2.2-3.6M6 8.5l4.1 1.7h3.8L18 8.5" />
                </svg>
              </div>
            </header>
            <div id="stretch-grid">
              <article class="stretch-item">
                <div class="pose-box">
                  <span>01</span>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <circle cx="40" cy="19" r="8" />
                    <path d="M40 27v25m-16-9 16-10 16 10M31 69l9-17 9 17M50 13c7 2 11 7 12 14" />
                    <path class="pose-arrow" d="m58 24 4 3 2-5" />
                  </svg>
                </div>
                <div class="stretch-copy">
                  <h3>颈部侧拉伸</h3>
                  <strong>左右各 15 秒</strong>
                  <p>肩膀放松，耳朵缓慢靠近肩部</p>
                </div>
              </article>
              <article class="stretch-item">
                <div class="pose-box">
                  <span>02</span>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <circle cx="40" cy="18" r="8" />
                    <path d="M40 26v27m0-18L22 42m18-7 18 7M31 69l9-16 9 16M22 42l-7-6m43 6 7-6" />
                    <path class="pose-arrow" d="M17 27c-5 3-7 8-6 14m52-14c5 3 7 8 6 14" />
                  </svg>
                </div>
                <div class="stretch-copy">
                  <h3>扩胸拉伸</h3>
                  <strong>保持 20 秒</strong>
                  <p>双手向后打开，挺胸但不要憋气</p>
                </div>
              </article>
              <article class="stretch-item">
                <div class="pose-box">
                  <span>03</span>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <circle cx="35" cy="18" r="8" />
                    <path d="M36 26c0 11 3 19 11 27m-10-20L26 47m11-14 6-14 5-7M36 69l11-16 6 16M36 69l-2-25" />
                    <path class="pose-arrow" d="M54 28c5 3 8 8 8 14m-4-3 4 3 2-5" />
                  </svg>
                </div>
                <div class="stretch-copy">
                  <h3>站姿侧伸展</h3>
                  <strong>左右各 15 秒</strong>
                  <p>手臂越过头顶，身体平稳向侧面弯</p>
                </div>
              </article>
              <article class="stretch-item">
                <div class="pose-box">
                  <span>04</span>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <circle cx="32" cy="17" r="8" />
                    <path d="M32 25c5 8 11 14 20 17M38 34 21 43m31-1 12 7M52 42l-7 25M21 43l-6 22m6-22 18 10" />
                    <path class="pose-arrow" d="M54 31c7 0 12 3 15 8m-5-1 5 1-1-5" />
                  </svg>
                </div>
                <div class="stretch-copy">
                  <h3>腿后侧拉伸</h3>
                  <strong>左右各 20 秒</strong>
                  <p>脚跟着地，背部保持自然伸直</p>
                </div>
              </article>
            </div>
            <div id="modal-note">
              <span>!</span>
              动作保持舒适即可；如果感到疼痛，请立即停止。
            </div>
            <footer id="modal-footer">
              <p>MOVE EASY. FEEL BETTER.</p>
              <button id="confirm" type="button">
                确认完成
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3 8 3 3 7-7" />
                </svg>
              </button>
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
