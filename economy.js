(() => {
  const STORAGE_KEY = "hfb-bugbucks-v1";
  const today = new Date().toLocaleDateString("en-CA");
  const freshDaily = () => ({ date: today, progress: {}, claimed: {}, visited: [] });

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const state = saved && typeof saved === "object" ? saved : {};
      state.balance = Number.isFinite(state.balance) ? state.balance : 0;
      state.lifetimeEarned = Number.isFinite(state.lifetimeEarned) ? state.lifetimeEarned : 0;
      state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
      state.activeItem = state.activeItem || "";
      state.once = state.once || { progress: {}, claimed: {} };
      if (!state.daily || state.daily.date !== today) state.daily = freshDaily();
      return state;
    } catch {
      return { balance: 0, lifetimeEarned: 0, inventory: [], activeItem: "", once: { progress: {}, claimed: {} }, daily: freshDaily() };
    }
  }

  let state = loadState();
  let quests = [];
  let shop = [];
  let achievements = [];
  let renderTimer = null;

  function save() {
    quests.forEach(quest => {
      if (quest.type === "lifetime_earned") setProgress(quest, state.lifetimeEarned);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateBalance();
  }

  function cleanPath(value) {
    let path = value.toLowerCase();
    if (path.endsWith("/")) path = path.slice(0, -1);
    if (path.endsWith(".html")) path = path.slice(0, -5);
    return path;
  }

  function currentPage() {
    const path = cleanPath(location.pathname);
    if (!path || path === "/index") return "home";
    if (path === "/about") return "about";
    if (path === "/rewards") return "rewards";
    return path.split("/").pop();
  }

  function updateBalance() {
    document.querySelectorAll("#bugbucks-balance").forEach(el => {
      el.textContent = state.balance + " BB";
    });
  }

  function bucketFor(quest) {
    return quest.frequency === "once" ? state.once : state.daily;
  }

  function questProgress(quest) {
    const bucket = bucketFor(quest);
    return Number(bucket.progress[quest.id] || 0);
  }

  function isClaimed(quest) {
    return Boolean(bucketFor(quest).claimed[quest.id]);
  }

  function setProgress(quest, value) {
    const bucket = bucketFor(quest);
    bucket.progress[quest.id] = Math.max(Number(bucket.progress[quest.id] || 0), value);
  }

  function recordPageVisit() {
    const page = currentPage();
    if (!state.daily.visited.includes(page)) state.daily.visited.push(page);
    if (!state.once.visited) state.once.visited = [];
    if (!state.once.visited.includes(page)) state.once.visited.push(page);

    quests.forEach(quest => {
      if (quest.type === "visit_page" && quest.page === page) {
        setProgress(quest, 1);
      }
      if (quest.type === "visit_pages") {
        const visited = quest.frequency === "once" ? state.once.visited : state.daily.visited;
        const count = quest.pages.filter(required => visited.includes(required)).length;
        setProgress(quest, count);
      }
    });
    save();
  }

  function recordLinkClick(event) {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const target = cleanPath(new URL(link.href, location.href).pathname);
    const page = target === "/about" ? "about"
      : target === "/rewards" ? "rewards"
      : target === "" || target === "/index" ? "home" : target.split("/").pop();
    quests.forEach(quest => {
      if (quest.type === "click_link" && quest.page === page) {
        const bucket = bucketFor(quest);
        bucket.progress[quest.id] = Number(bucket.progress[quest.id] || 0) + 1;
      }
    });
    save();
  }

  function startTimeTracking() {
    let last = Date.now();
    renderTimer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(Math.floor((now - last) / 1000), 5);
      last = now;
      if (document.visibilityState !== "visible" || elapsed <= 0) return;
      quests.forEach(quest => {
        if (quest.type === "time_on_site") {
          setProgress(quest, questProgress(quest) + elapsed);
        }
      });
      save();
      if (currentPage() === "rewards") renderQuests();
    }, 1000);
  }

  function renderQuests() {
    const container = document.getElementById("quest-list");
    if (!container) return;
    container.innerHTML = "";
    quests.forEach(quest => {
      const progress = questProgress(quest);
      const claimed = isClaimed(quest);
      const complete = progress >= quest.target;
      const card = document.createElement("article");
      card.className = "quest-card";
      const heading = document.createElement("h3");
      heading.textContent = quest.title;
      const description = document.createElement("p");
      description.textContent = quest.description;
      const progressText = document.createElement("p");
      const shownProgress = quest.type === "time_on_site" ? Math.min(progress, quest.target) + " / " + quest.target + " seconds" : Math.min(progress, quest.target) + " / " + quest.target;
      progressText.className = "quest-progress";
      progressText.textContent = claimed ? "Reward claimed" : shownProgress;
      const reward = document.createElement("strong");
      reward.className = "quest-reward";
      reward.textContent = "+" + quest.reward + " BB";
      const button = document.createElement("button");
      button.textContent = claimed ? "Claimed" : complete ? "Claim reward" : "In progress";
      button.disabled = !complete || claimed;
      button.addEventListener("click", () => {
        if (!complete || isClaimed(quest)) return;
        bucketFor(quest).claimed[quest.id] = true;
        state.balance += quest.reward;
        state.lifetimeEarned += quest.reward;
        save();
        renderQuests();
        renderAchievements();
      });
      card.append(heading, description, progressText, reward, button);
      container.append(card);
    });
  }

  function renderShop() {
    const container = document.getElementById("shop-list");
    if (!container) return;
    container.innerHTML = "";
    shop.forEach(item => {
      const owned = state.inventory.includes(item.id);
      const active = state.activeItem === item.id;
      const card = document.createElement("article");
      card.className = "shop-card";
      const heading = document.createElement("h3");
      heading.textContent = item.name;
      const description = document.createElement("p");
      description.textContent = item.description;
      const price = document.createElement("strong");
      price.textContent = item.price + " BB";
      const button = document.createElement("button");
      button.textContent = active ? "Equipped" : owned ? "Equip" : "Buy";
      button.disabled = active || (!owned && state.balance < item.price);
      button.addEventListener("click", () => {
        if (!state.inventory.includes(item.id)) {
          if (state.balance < item.price) return;
          state.balance -= item.price;
          state.inventory.push(item.id);
        }
        state.activeItem = item.id;
        save();
        renderShop();
      });
      card.append(heading, description, price, button);
      container.append(card);
    });
  }

  function renderAchievements() {
    const container = document.getElementById("achievement-list");
    if (!container) return;
    container.innerHTML = "";
    achievements.forEach(item => {
      const unlocked = state.lifetimeEarned >= item.totalEarned;
      const card = document.createElement("article");
      card.className = "achievement-card" + (unlocked ? " unlocked" : "");
      const heading = document.createElement("h3");
      heading.textContent = (unlocked ? "🏆 " : "🔒 ") + item.name;
      const description = document.createElement("p");
      description.textContent = item.description;
      card.append(heading, description);
      container.append(card);
    });
  }

  async function init() {
    updateBalance();
    try {
      const response = await fetch("/quests.json");
      if (!response.ok) throw new Error("Could not load quests.json");
      const config = await response.json();
      quests = config.quests || [];
      shop = config.shop || [];
      achievements = config.achievements || [];
      recordPageVisit();
      document.addEventListener("click", recordLinkClick);
      renderQuests();
      renderShop();
      renderAchievements();
      startTimeTracking();
    } catch (error) {
      const container = document.getElementById("quest-list");
      if (container) container.textContent = "Couldn't load quests.json. Check that the file is published.";
      console.error(error);
    }
  }

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      updateBalance();
      renderQuests();
      renderShop();
      renderAchievements();
    }
  });

  init();
})();
