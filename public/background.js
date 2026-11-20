const REMINDERS_KEY = "westside-reminders";
const PAUSED_KEY = "westside-reminders-paused";
const ALARM_PREFIX = "wellness-reminder-";
const MIN_ALARM_PERIOD_MINUTES = 10 / 60;

const DEFAULT_REMINDERS = [
  { id: "water", name: "喝水", enabled: true, interval: 45 },
  { id: "stand", name: "站立拉伸", enabled: true, interval: 60 },
  { id: "pelvic", name: "提肛训练", enabled: false, interval: 90 },
];

const REMINDER_MESSAGES = {
  water: {
    title: "Yo，补水时间到了",
    message: "别让自己干着，homie。拿起杯子喝几口，状态保持在线。",
  },
  stand: {
    title: "Ayo，起来走两步",
    message: "椅子坐够了，G。站起来伸个懒腰，让身体松一松。",
  },
  pelvic: {
    title: "听着，该练核心了",
    message: "低调收紧，稳住节奏。没人发现，但你知道自己在变强。",
  },
};

let scheduleQueue = Promise.resolve();

async function initializeSettings() {
  const settings = await chrome.storage.local.get([REMINDERS_KEY, PAUSED_KEY]);
  const updates = {};

  if (!Array.isArray(settings[REMINDERS_KEY])) {
    updates[REMINDERS_KEY] = DEFAULT_REMINDERS;
  }
  if (typeof settings[PAUSED_KEY] !== "boolean") {
    updates[PAUSED_KEY] = false;
  }
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

function scheduleReminders() {
  scheduleQueue = scheduleQueue
    .then(async () => {
      const settings = await chrome.storage.local.get([REMINDERS_KEY, PAUSED_KEY]);
      const existingAlarms = await chrome.alarms.getAll();
      await Promise.all(
        existingAlarms
          .filter((alarm) => alarm.name.startsWith(ALARM_PREFIX))
          .map((alarm) => chrome.alarms.clear(alarm.name)),
      );

      if (settings[PAUSED_KEY] === true || !Array.isArray(settings[REMINDERS_KEY])) return;

      for (const reminder of settings[REMINDERS_KEY]) {
        if (
          !reminder ||
          typeof reminder !== "object" ||
          reminder.enabled !== true ||
          typeof reminder.id !== "string" ||
          !Object.hasOwn(REMINDER_MESSAGES, reminder.id) ||
          typeof reminder.interval !== "number" ||
          !Number.isFinite(reminder.interval) ||
          reminder.interval < MIN_ALARM_PERIOD_MINUTES
        ) {
          continue;
        }

        chrome.alarms.create(`${ALARM_PREFIX}${reminder.id}`, {
          delayInMinutes: reminder.interval,
          periodInMinutes: reminder.interval,
        });
      }
    })
    .catch((error) => {
      console.error("无法安排健康提醒", error);
    });
}

async function sendToActiveTab(request, focusWindow = false) {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab?.id) {
    throw new Error("未找到当前活动标签页");
  }
  if (focusWindow && activeTab.windowId !== undefined) {
    await chrome.windows.update(activeTab.windowId, { focused: true });
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(activeTab.id, request);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["content.js"],
    });
    response = await chrome.tabs.sendMessage(activeTab.id, request);
  }

  if (!response || response.ok !== true) {
    throw new Error(response?.error || "当前页面不支持显示提醒");
  }
}

function showInActiveTab(reminderId, title, message) {
  return sendToActiveTab({
    type: "SHOW_TAB_REMINDER",
    reminderId,
    title,
    message,
  });
}

function showSystemNotification(reminderId, title, message) {
  const notificationId = `wellness-notification-${reminderId}-${Date.now()}`;
  const options = {
    type: "basic",
    iconUrl: "favicon.png",
    title,
    message,
    priority: 2,
    ...(reminderId === "stand" ? { buttons: [{ title: "好的" }] } : {}),
  };

  return new Promise((resolve, reject) => {
    chrome.notifications.create(notificationId, options, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message || "无法发送系统通知"));
      } else {
        resolve(notificationId);
      }
    });
  });
}

async function showReminder(reminderId, title, message) {
  let browserFocused = false;
  try {
    const lastFocusedWindow = await chrome.windows.getLastFocused({ populate: false });
    browserFocused = lastFocusedWindow.focused === true;
  } catch (error) {
    console.error("无法检测浏览器窗口状态，将使用系统通知", error);
  }

  if (browserFocused) {
    return showInActiveTab(reminderId, title, message);
  }
  return showSystemNotification(reminderId, title, message);
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeSettings()
    .then(scheduleReminders)
    .catch((error) => {
      console.error("无法初始化健康提醒", error);
    });
});

chrome.runtime.onStartup.addListener(scheduleReminders);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes[REMINDERS_KEY] || changes[PAUSED_KEY])) {
    scheduleReminders();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const reminderId = alarm.name.slice(ALARM_PREFIX.length);
  const reminderMessage = REMINDER_MESSAGES[reminderId];
  if (!reminderMessage) return;

  chrome.storage.local
    .get([REMINDERS_KEY, PAUSED_KEY])
    .then((settings) => {
      const reminder = Array.isArray(settings[REMINDERS_KEY])
        ? settings[REMINDERS_KEY].find((item) => item?.id === reminderId)
        : undefined;
      if (settings[PAUSED_KEY] === true || reminder?.enabled !== true) return;

      return showReminder(reminderId, reminderMessage.title, reminderMessage.message);
    })
    .catch((error) => {
      console.error("无法显示健康提醒", error);
    });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (
    !request ||
    request.type !== "SHOW_TAB_REMINDER" ||
    !Object.hasOwn(REMINDER_MESSAGES, request.reminderId) ||
    typeof request.title !== "string" ||
    typeof request.message !== "string"
  ) {
    return;
  }

  void showReminder(request.reminderId, request.title, request.message)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "无法显示标签页提醒",
      });
    });
  return true;
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex !== 0 || !notificationId.startsWith("wellness-notification-stand-")) {
    return;
  }

  void sendToActiveTab({ type: "SHOW_STRETCH_GUIDE" }, true)
    .then(() => chrome.notifications.clear(notificationId))
    .catch((error) => {
      console.error("无法打开拉伸动作说明", error);
    });
});
