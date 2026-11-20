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
  { value: 5 / 60, label: "5 秒" },
  { value: 15, label: "15 分钟" },
  { value: 30, label: "30 分钟" },
  { value: 45, label: "45 分钟" },
  { value: 60, label: "60 分钟" },
  { value: 90, label: "90 分钟" },
  { value: 120, label: "120 分钟" },
];

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

export default function App() {
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem("westside-reminders");
      return saved ? JSON.parse(saved) : defaultReminders;
    } catch {
      return defaultReminders;
    }
  });
  const [allPaused, setAllPaused] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    localStorage.setItem("westside-reminders", JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
    setToast(message);
    if ("Notification" in window) {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission === "granted") {
        new Notification(message.title, { body: message.body });
      }
    }
  };

  return (
    <main className="app-shell">
      <section className="popup">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span>W</span>
            </div>
            <div>
              <p className="eyebrow">WEST COAST WELLNESS</p>
              <h1>
                WESTSIDE <span>REMINDERS</span>
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
            <strong>{allPaused ? "提醒已暂停" : "街区在线"}</strong>
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
            <p>YOUR ROUTINE</p>
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
          <div className="footer-sign">STAY SHARP.</div>
        </footer>
      </section>

      {toast && (
        <div className="toast" role="status">
          <div className="toast-icon">W</div>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.body}</p>
          </div>
          <button type="button" onClick={() => setToast(null)} aria-label="关闭提醒">
            ×
          </button>
        </div>
      )}
    </main>
  );
}
