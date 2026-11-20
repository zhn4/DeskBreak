import { useEffect, useMemo, useState } from "react";

type ReminderId = "water" | "stand" | "pelvic";

type Reminder = {
  id: ReminderId;
  name: string;
  tag: string;
  description: string;
  enabled: boolean;
  interval: number;
  color: string;
  icon: "drop" | "stretch" | "core";
};

type ExtensionStorageArea = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

type ExtensionRuntime = {
  sendMessage(message: {
    type: "SHOW_TAB_REMINDER";
    reminderId: ReminderId;
    title: string;
    message: string;
  }): Promise<unknown>;
};

declare global {
  interface Window {
    chrome?: {
      storage?: { local: ExtensionStorageArea };
      runtime?: ExtensionRuntime;
    };
  }
}

const remindersStorageKey = "westside-reminders";
const pausedStorageKey = "westside-reminders-paused";

const defaultReminders: Reminder[] = [
  {
    id: "water",
    name: "喝水",
    tag: "HYDRATE",
    description: "喝一口，继续保持状态",
    enabled: true,
    interval: 45,
    color: "#50C7ED",
    icon: "drop",
  },
  {
    id: "stand",
    name: "站立拉伸",
    tag: "STRETCH",
    description: "离开椅子，活动活动",
    enabled: true,
    interval: 60,
    color: "#FFB649",
    icon: "stretch",
  },
  {
    id: "pelvic",
    name: "提肛训练",
    tag: "LOCK IN",
    description: "收紧核心，悄悄练一组",
    enabled: false,
    interval: 90,
    color: "#F276B7",
    icon: "core",
  },
];

const messages: Record<ReminderId, { title: string; body: string }> = {
  water: {
    title: "Yo，补水时间到了",
    body: "别让自己干着，homie。拿起杯子喝几口，状态保持在线。",
  },
  stand: {
    title: "Ayo，起来走两步",
    body: "椅子坐够了，G。站起来伸个懒腰，让身体松一松。",
  },
  pelvic: {
    title: "听着，该练核心了",
    body: "低调收紧，稳住节奏。没人发现，但你知道自己在变强。",
  },
};

const intervalOptions = [
  { value: 10 / 60, label: "10 秒" },
  { value: 15, label: "15 分钟" },
  { value: 30, label: "30 分钟" },
  { value: 45, label: "45 分钟" },
  { value: 60, label: "60 分钟" },
  { value: 90, label: "90 分钟" },
  { value: 120, label: "120 分钟" },
];

function isReminderList(value: unknown): value is Reminder[] {
  if (!Array.isArray(value)) return false;

  return value.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;

    return (
      "id" in item &&
      (item.id === "water" || item.id === "stand" || item.id === "pelvic") &&
      "name" in item &&
      typeof item.name === "string" &&
      "tag" in item &&
      typeof item.tag === "string" &&
      "description" in item &&
      typeof item.description === "string" &&
      "enabled" in item &&
      typeof item.enabled === "boolean" &&
      "interval" in item &&
      typeof item.interval === "number" &&
      Number.isFinite(item.interval) &&
      item.interval >= 10 / 60 &&
      "color" in item &&
      typeof item.color === "string" &&
      "icon" in item &&
      (item.icon === "drop" || item.icon === "stretch" || item.icon === "core")
    );
  });
}

function Icon({ name }: { name: Reminder["icon"] }) {
  if (name === "drop") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.2S6.5 9.3 6.5 14a5.5 5.5 0 0 0 11 0C17.5 9.3 12 3.2 12 3.2Z" />
        <path d="M9.5 15.2c.3 1.3 1.1 2 2.3 2.3" />
      </svg>
    );
  }

  if (name === "stretch") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5" r="2.2" />
        <path d="M8.3 21l2.1-6.2-2-3.8m7.3 10-2.2-6.4 2.2-3.6M6 8.5l4.1 1.7h3.8L18 8.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.2c3 0 5.5 2.4 5.5 5.4 0 4.7-2.4 9-5.5 12.2-3.1-3.2-5.5-7.5-5.5-12.2 0-3 2.5-5.4 5.5-5.4Z" />
      <path d="M9.3 9.5c1.8 1.2 3.6 1.2 5.4 0M9.8 13c1.5.8 2.9.8 4.4 0" />
    </svg>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "toggle-on" : ""}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

type StretchPose = "neck" | "chest" | "side" | "legs";

function PoseIllustration({ pose }: { pose: StretchPose }) {
  if (pose === "neck") {
    return (
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="19" r="8" />
        <path d="M40 27v25m-16-9 16-10 16 10M31 69l9-17 9 17M50 13c7 2 11 7 12 14" />
        <path className="pose-arrow" d="m58 24 4 3 2-5" />
      </svg>
    );
  }

  if (pose === "chest") {
    return (
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="18" r="8" />
        <path d="M40 26v27m0-18L22 42m18-7 18 7M31 69l9-16 9 16M22 42l-7-6m43 6 7-6" />
        <path className="pose-arrow" d="M17 27c-5 3-7 8-6 14m52-14c5 3 7 8 6 14" />
      </svg>
    );
  }

  if (pose === "side") {
    return (
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="35" cy="18" r="8" />
        <path d="M36 26c0 11 3 19 11 27m-10-20L26 47m11-14 6-14 5-7M36 69l11-16 6 16M36 69l-2-25" />
        <path className="pose-arrow" d="M54 28c5 3 8 8 8 14m-4-3 4 3 2-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="32" cy="17" r="8" />
      <path d="M32 25c5 8 11 14 20 17M38 34 21 43m31-1 12 7M52 42l-7 25M21 43l-6 22m6-22 18 10" />
      <path className="pose-arrow" d="M54 31c7 0 12 3 15 8m-5-1 5 1-1-5" />
    </svg>
  );
}

const stretches: { pose: StretchPose; name: string; duration: string; tip: string }[] = [
  { pose: "neck", name: "颈部侧拉伸", duration: "左右各 15 秒", tip: "肩膀放松，耳朵缓慢靠近肩部" },
  { pose: "chest", name: "扩胸拉伸", duration: "保持 20 秒", tip: "双手向后打开，挺胸但不要憋气" },
  {
    pose: "side",
    name: "站姿侧伸展",
    duration: "左右各 15 秒",
    tip: "手臂越过头顶，身体平稳向侧面弯",
  },
  { pose: "legs", name: "腿后侧拉伸", duration: "左右各 20 秒", tip: "脚跟着地，背部保持自然伸直" },
];

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem(remindersStorageKey);
      return saved ? JSON.parse(saved) : defaultReminders;
    } catch {
      return defaultReminders;
    }
  });
  const [allPaused, setAllPaused] = useState(false);
  const [settingsReady, setSettingsReady] = useState(() => !window.chrome?.storage?.local);
  const [testError, setTestError] = useState<string | null>(null);
  const [previewToast, setPreviewToast] = useState<{
    reminderId: ReminderId;
    title: string;
    body: string;
  } | null>(null);
  const [showStretchGuide, setShowStretchGuide] = useState(false);
  const [now, setNow] = useState(Date.now());
  const extensionStorage = window.chrome?.storage?.local;

  useEffect(() => {
    if (!extensionStorage) return;

    let active = true;
    extensionStorage
      .get([remindersStorageKey, pausedStorageKey])
      .then((settings) => {
        if (!active) return;
        if (isReminderList(settings[remindersStorageKey])) {
          setReminders(settings[remindersStorageKey]);
        }
        if (typeof settings[pausedStorageKey] === "boolean") {
          setAllPaused(settings[pausedStorageKey]);
        }
      })
      .catch((error: unknown) => {
        console.error("无法读取提醒设置", error);
      })
      .finally(() => {
        if (active) setSettingsReady(true);
      });

    return () => {
      active = false;
    };
  }, [extensionStorage]);

  useEffect(() => {
    localStorage.setItem(remindersStorageKey, JSON.stringify(reminders));
    if (!settingsReady || !extensionStorage) return;

    void extensionStorage
      .set({
        [remindersStorageKey]: reminders,
        [pausedStorageKey]: allPaused,
      })
      .catch((error: unknown) => {
        console.error("无法保存提醒设置", error);
      });
  }, [allPaused, extensionStorage, reminders, settingsReady]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!previewToast) return;
    const timeout = window.setTimeout(
      () => setPreviewToast(null),
      previewToast.reminderId === "stand" ? 10000 : 4200,
    );
    return () => window.clearTimeout(timeout);
  }, [previewToast]);

  useEffect(() => {
    if (!showStretchGuide) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowStretchGuide(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showStretchGuide]);

  const activeCount = reminders.filter((item) => item.enabled).length;
  const nextReminder = useMemo(() => {
    const active = reminders.filter((item) => item.enabled);
    if (!active.length || allPaused) return null;
    const first = [...active].sort((a, b) => a.interval - b.interval)[0];
    const cycle = first.interval * 60 * 1000;
    const remaining = cycle - (now % cycle);
    return {
      name: first.name,
      minutes: Math.floor(remaining / 60000),
      seconds: Math.floor((remaining % 60000) / 1000),
    };
  }, [allPaused, now, reminders]);

  const updateReminder = (id: ReminderId, update: Partial<Reminder>) => {
    setReminders((items) => items.map((item) => (item.id === id ? { ...item, ...update } : item)));
  };

  const sendTest = async (reminder: Reminder) => {
    const message = messages[reminder.id];

    setTestError(null);
    try {
      if (import.meta.env.DEV) {
        setPreviewToast({ reminderId: reminder.id, ...message });
        return;
      }

      if (!window.chrome?.runtime) {
        throw new Error("请在 Chrome 扩展中测试标签页提醒");
      }

      const response = await window.chrome.runtime.sendMessage({
        type: "SHOW_TAB_REMINDER",
        reminderId: reminder.id,
        title: message.title,
        message: message.body,
      });
      if (
        typeof response === "object" &&
        response !== null &&
        "error" in response &&
        typeof response.error === "string"
      ) {
        throw new Error(response.error);
      }
      if (
        typeof response !== "object" ||
        response === null ||
        !("ok" in response) ||
        response.ok !== true
      ) {
        throw new Error("无法在当前标签页显示提醒");
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "发送通知失败");
    }
  };

  return (
    <main className="app-shell">
      <section className="popup">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span>健</span>
            </div>
            <div>
              <p className="eyebrow">养成健康习惯</p>
              <h1>
                喝水站立<span>提醒</span>
              </h1>
            </div>
          </div>
          <button className="more-button" type="button" aria-label="更多设置">
            <span />
            <span />
            <span />
          </button>
        </header>

        <div className="status-strip">
          <div className={`live-dot ${allPaused ? "paused" : ""}`} />
          <div>
            <strong>{allPaused ? "提醒已暂停" : "提醒已上线"}</strong>
            <p>{allPaused ? "所有提醒暂时休息" : `${activeCount} 个提醒正在罩着你`}</p>
          </div>
          <button
            type="button"
            className={`pause-button ${allPaused ? "resume" : ""}`}
            onClick={() => setAllPaused((value) => !value)}
          >
            {allPaused ? "继续" : "全部暂停"}
          </button>
        </div>

        <div className="section-heading">
          <div>
            <p>听我说</p>
            <h2>今天要照顾好自己，G</h2>
          </div>
          <span>{activeCount}/3 开启</span>
        </div>

        <div className="reminder-list">
          {reminders.map((reminder) => (
            <article
              className={`reminder-card ${reminder.enabled ? "active" : ""}`}
              key={reminder.id}
              style={{ "--accent": reminder.color } as React.CSSProperties}
            >
              <div className="accent-line" />
              <div className="card-top">
                <div className="reminder-identity">
                  <div className="reminder-icon">
                    <Icon name={reminder.icon} />
                  </div>
                  <div>
                    <div className="name-line">
                      <h3>{reminder.name}</h3>
                      <span>{reminder.tag}</span>
                    </div>
                    <p>{reminder.description}</p>
                  </div>
                </div>
                <Toggle
                  checked={reminder.enabled}
                  onChange={() => updateReminder(reminder.id, { enabled: !reminder.enabled })}
                  label={`${reminder.name}提醒`}
                />
              </div>

              <div className="card-controls">
                <label htmlFor={`interval-${reminder.id}`}>每隔</label>
                <div className="select-wrap">
                  <select
                    id={`interval-${reminder.id}`}
                    value={reminder.interval}
                    disabled={!reminder.enabled}
                    onChange={(event) =>
                      updateReminder(reminder.id, {
                        interval: Number(event.target.value),
                      })
                    }
                  >
                    {intervalOptions.map((option) => (
                      <option value={option.value} key={option.label}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </div>
                <button
                  className="test-button"
                  type="button"
                  disabled={!reminder.enabled}
                  onClick={() => sendTest(reminder)}
                >
                  测试提醒
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m6 3 5 5-5 5" />
                  </svg>
                </button>
              </div>
              {testError && (
                <p role="alert" style={{ color: "#b42318", fontSize: "12px", marginTop: "8px" }}>
                  {testError}
                </p>
              )}
            </article>
          ))}
        </div>

        <footer className="footer">
          <div className="next-reminder">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5v5l3.2 2" />
            </svg>
            <div>
              <p>下次提醒</p>
              <strong>
                {nextReminder
                  ? `${nextReminder.name} · ${String(nextReminder.minutes).padStart(2, "0")}:${String(nextReminder.seconds).padStart(2, "0")}`
                  : "暂无安排"}
              </strong>
            </div>
          </div>
          <div className="footer-sign">动起来</div>
        </footer>
      </section>

      {previewToast && (
        <div className="toast" role="status">
          <div className="toast-icon">W</div>
          <div className="toast-copy">
            <strong>{previewToast.title}</strong>
            <p>{previewToast.body}</p>
          </div>
          <div className="toast-actions">
            <button
              className="toast-close"
              type="button"
              onClick={() => setPreviewToast(null)}
              aria-label="关闭提醒"
            >
              ×
            </button>
            {previewToast.reminderId === "stand" && (
              <button
                className="toast-accept"
                type="button"
                onClick={() => {
                  setPreviewToast(null);
                  setShowStretchGuide(true);
                }}
              >
                看图拉伸
              </button>
            )}
          </div>
        </div>
      )}

      {showStretchGuide && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="stretch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stretch-title"
          >
            <div className="modal-heading">
              <div>
                <p>QUICK RESET · 2 MIN</p>
                <h2 id="stretch-title">起身松一松，G</h2>
                <span>跟着做一轮，把久坐的紧绷留在椅子上。</span>
              </div>
              <div className="modal-badge" aria-hidden="true">
                <Icon name="stretch" />
              </div>
            </div>

            <div className="stretch-grid">
              {stretches.map((stretch, index) => (
                <article className="stretch-item" key={stretch.pose}>
                  <div className="pose-box">
                    <span>0{index + 1}</span>
                    <PoseIllustration pose={stretch.pose} />
                  </div>
                  <div className="stretch-copy">
                    <h3>{stretch.name}</h3>
                    <strong>{stretch.duration}</strong>
                    <p>{stretch.tip}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="modal-note">
              <span>!</span>
              动作保持舒适即可；如果感到疼痛，请立即停止。
            </div>

            <footer className="modal-footer">
              <p>MOVE EASY. FEEL BETTER.</p>
              <button type="button" onClick={() => setShowStretchGuide(false)} autoFocus>
                确认完成
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3 8 3 3 7-7" />
                </svg>
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
