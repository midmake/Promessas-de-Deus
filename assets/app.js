import { promessas } from "./promessas.js";

const root = document.documentElement;
const themeToggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const promiseText = document.querySelector("#promise-text");
const promiseReference = document.querySelector("#promise-reference");
const translationNote = document.querySelector("#translation-note");

const STORAGE_KEY = "vereda-promessas-theme";

function applyTheme(theme) {
  const isDark = theme === "dark";
  root.dataset.theme = isDark ? "dark" : "light";
  themeToggle?.setAttribute("aria-pressed", String(isDark));
  themeColor?.setAttribute("content", isDark ? "#101b18" : "#f6f1e7");
}

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function renderDevelopmentPromise() {
  const promise = promessas.find((item) => item.ativo);
  if (!promise) return;

  promiseText.textContent = promise.texto;
  promiseReference.textContent = promise.referencia;
  translationNote.textContent = promise.traducao;
}

applyTheme(getInitialTheme());
renderDevelopmentPromise();

themeToggle?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
});
