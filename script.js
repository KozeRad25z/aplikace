"use strict";

const STORAGE_KEY = "gjak-skolni-planovac-ukoly";
const taskList = document.querySelector("#task-list");
const taskForm = document.querySelector("#task-form");
const storageNotice = document.querySelector("#storage-notice");
const today = new Date();
const todayKey = toDateKey(today);

let tasks = loadTasks();
let activeFilter = "all";

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(today);

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    document.querySelector("#task-title").focus();
    return;
  }

  tasks.push({
    id: createId(),
    title,
    subject: String(formData.get("subject") || ""),
    dueDate: String(formData.get("dueDate") || ""),
    notes: String(formData.get("notes") || "").trim(),
    completed: false,
    createdAt: Date.now()
  });
  saveAndRender();
  taskForm.reset();
  document.querySelector("#task-title").focus();
});

document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
});

function toDateKey(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTasks() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new TypeError("Uložená data nemají očekávaný formát.");
    return parsed.filter((task) =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean"
    ).map((task) => ({
      id: task.id,
      title: task.title,
      subject: typeof task.subject === "string" ? task.subject : "",
      dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
      notes: typeof task.notes === "string" ? task.notes : "",
      completed: task.completed,
      createdAt: Number.isFinite(task.createdAt) ? task.createdAt : 0
    }));
  } catch (error) {
    showStorageError("Uložené úkoly se nepodařilo načíst. Zkontroluj nastavení úložiště prohlížeče.");
    console.error("Načítání úkolů z localStorage selhalo:", error);
    return [];
  }
}

function saveAndRender() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    storageNotice.hidden = true;
    storageNotice.textContent = "";
  } catch (error) {
    showStorageError("Změny se nepodařilo uložit. Zkontroluj volné místo a nastavení úložiště prohlížeče.");
    console.error("Ukládání úkolů do localStorage selhalo:", error);
  }
  render();
}

function showStorageError(message) {
  storageNotice.textContent = message;
  storageNotice.hidden = false;
}

function formatDueDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short" })
    .format(new Date(year, month - 1, day));
}

function getVisibleTasks() {
  const filtered = tasks.filter((task) => {
    if (activeFilter === "active") return !task.completed;
    if (activeFilter === "completed") return task.completed;
    return true;
  });
  return filtered.sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.createdAt - b.createdAt;
  });
}

function render() {
  const pendingCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.length - pendingCount;
  document.querySelector("#total-count").textContent = String(tasks.length);
  document.querySelector("#pending-count").textContent = String(pendingCount);
  document.querySelector("#done-count").textContent = String(completedCount);
  document.querySelector("#nav-count").textContent = String(pendingCount);
  document.querySelector("#all-filter-count").textContent = String(tasks.length);

  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren();
  if (visibleTasks.length === 0) {
    taskList.append(createEmptyState());
    return;
  }
  visibleTasks.forEach((task) => taskList.append(createTaskRow(task)));
}

function createEmptyState() {
  const container = document.createElement("div");
  container.className = "empty-state";

  const icon = document.createElement("span");
  icon.className = "empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10v16H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7"/><path d="M9 9h6m-6 4h6m-6 4h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

  const heading = document.createElement("h3");
  const description = document.createElement("p");
  if (activeFilter === "completed") {
    heading.textContent = "Zatím žádné hotové úkoly";
    description.textContent = "Až nějaký úkol dokončíš, najdeš ho právě tady.";
  } else if (activeFilter === "active") {
    heading.textContent = "Všechno máš hotové!";
    description.textContent = "Teď si můžeš na chvíli oddechnout.";
  } else {
    heading.textContent = "Zatím tu nic není";
    description.textContent = "Přidej svůj první úkol a naplánuj si studium.";
  }

  container.append(icon, heading, description);
  return container;
}

function createTaskRow(task) {
  const row = document.createElement("article");
  row.className = `task-row${task.completed ? " is-complete" : ""}`;

  const checkButton = document.createElement("button");
  checkButton.type = "button";
  checkButton.className = "task-check";
  checkButton.setAttribute("aria-label", task.completed ? `Označit úkol ${task.title} jako nedokončený` : `Označit úkol ${task.title} jako hotový`);
  checkButton.setAttribute("aria-pressed", String(task.completed));
  checkButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  checkButton.addEventListener("click", () => {
    task.completed = !task.completed;
    saveAndRender();
  });

  const main = document.createElement("div");
  main.className = "task-main";
  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;
  main.append(title);

  if (task.notes) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    main.append(notes);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  if (task.subject) {
    const subject = document.createElement("span");
    subject.className = "subject-pill";
    subject.textContent = task.subject;
    meta.append(subject);
  }
  main.append(meta);

  if (task.dueDate) {
    const date = document.createElement("span");
    const isOverdue = !task.completed && task.dueDate < todayKey;
    const isToday = task.dueDate === todayKey;
    date.className = `task-date${task.completed ? " done-date" : isOverdue ? " overdue" : isToday ? " due-today" : ""}`;
    date.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M16 3v4M8 3v4M4 10h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    const dateText = document.createElement("span");
    dateText.textContent = isOverdue ? `Po termínu · ${formatDueDate(task.dueDate)}` : isToday ? "Odevzdat dnes" : formatDueDate(task.dueDate);
    date.append(dateText);
    meta.append(date);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.setAttribute("aria-label", `Smazat úkol ${task.title}`);
  deleteButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  deleteButton.addEventListener("click", () => {
    tasks = tasks.filter((item) => item.id !== task.id);
    saveAndRender();
  });

  row.append(checkButton, main, deleteButton);
  return row;
}

render();
