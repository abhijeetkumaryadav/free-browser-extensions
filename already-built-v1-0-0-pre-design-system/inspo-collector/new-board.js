// Inspo Collector — new board page logic

document.getElementById("create").addEventListener("click", create);
document.getElementById("name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") create();
});

async function create() {
  const input = document.getElementById("name");
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  const { boards = [] } = await chrome.storage.local.get("boards");
  boards.push({
    id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: Date.now(),
  });
  await chrome.storage.local.set({ boards });
  window.close();
}
