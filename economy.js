(() => {
  const STORAGE_KEY = "hfb-bugbucks-v1";

  function localDateKey() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  const freshDaily = () => ({ date: localDateKey(), progress: {}, claimed: {}, visited: [] });

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const state = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
      state.balance = Number.isFinite(state.balance) ? Math.max(0, state.balance) : 0;
      state.lifetimeEarned = Number.isFinite(state.lifetimeEarned) ? Math.max(0, state.lifetimeEarned) : 0;
      state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
      state.activeItem = typeof state.activeItem === "string" ? state.activeItem : "";
      state.once = state.once && typeof state.once === "object" ? state.once : {};
      state.once.progress = state.once.progress || {};
      state.once.claimed = state.once.claimed || {};
      state.once.visited = Array.isArray(state.once.visited) ? state.once.visited : [];
      if (!state.daily || state.daily.date !== localDateKey()) state.daily = freshDaily();
      state.daily.progress = state.daily.progress || {};
      state.daily.claimed = state.daily.claimed || {};
      state.daily.visited = Array.isArray(state.daily.visited) ? state.daily.visited : [];
      return state;
    } catch {
      return {
        balance: 0,
        lifetimeEarned: 0,
        inventory: [],
        activeItem: "",
        once: { progress: {}, claimed: {}, visited: [] },
        daily: freshDaily()
      };
    }
  }

  let state = loadState();
  let quests = [];
  let shop = [];
  let achievements = [];
  let lastTick = Date.now();
  let secondsSinceSave = 0;

  function save() {
    quests.forEach(quest => {
      if (quest.type === "lifetime_earned") setProgress(quest, state.lifetimeEarned);
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("BugBucks could not save this browser's data.", error);
    }
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
    const text = state.balance + " BB";
    document.querySelectorAll("#bugbucks-balance, #wallet-balance").forEach(el => {
      if (el.textContent !== text) el.textContent = text;
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

  function updateQuestCard(quest) {
    const card = document.querySelector('[data-quest-id="' + quest.id + '"]');
    if (!card) return;
    const progress = questProgress(quest);
    const claimed = isClaimed(quest);
    const complete = progress >= quest.target;
    const progressText = card.querySelector("[data-quest-progress]");
    const progressFill = card.querySelector("[data-progress-fill]");
    const stateLabel = card.querySelector("[data-quest-state]");
    const button = card.querySelector("button");
    const shownProgress = quest.type === "time_on_site"
      ? Math.min(progress, quest.target) + " / " + quest.target + " sec"
      : Math.min(progress, quest.target) + " / " + quest.target;
    progressText.textContent = claimed ? "Reward collected" : shownProgress;
    progressFill.style.width = Math.min(100, (progress / quest.target) * 100) + "%";
    progressFill.parentElement.setAttribute("aria-valuenow", String(Math.min(progress, quest.target)));
    stateLabel.textContent = claimed ? "Claimed" : complete ? "Ready to claim" : "In progress";
    stateLabel.className = "quest-state" + (claimed ? " claimed" : complete ? " ready" : "");
    card.classList.toggle("is-ready", complete && !claimed);
    card.classList.toggle("is-claimed", claimed);
    button.textContent = claimed ? "Collected" : complete ? "Claim +" + quest.reward + " BB" : "Keep going";
    button.disabled = !complete || claimed;
  }

  function updateQuestCards() {
    quests.forEach(updateQuestCard);
  }

  function recordPageVisit() {
    const page = currentPage();
    if (!state.daily.visited.includes(page)) state.daily.visited.push(page);
    if (!state.once.visited.includes(page)) state.once.visited.push(page);

    quests.forEach(quest => {
      if (quest.type === "visit_page" && quest.page === page) setProgress(quest, 1);
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
    let target;
    try {
      target = cleanPath(new URL(link.href, location.href).pathname);
    } catch {
      return;
    }
    const page = target === "/about" ? "about"
      : target === "/rewards" ? "rewards"
      : target === "" || target === "/" || target === "/index" ? "home"
      : target.split("/").pop();
    let changed = false;
    quests.forEach(quest => {
      if (quest.type === "click_link" && quest.page === page) {
        const bucket = bucketFor(quest);
        bucket.progress[quest.id] = Number(bucket.progress[quest.id] || 0) + 1;
        changed = true;
      }
    });
    if (changed) {
      save();
      updateQuestCards();
    }
  }

  function startTimeTracking() {
    window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState !== "visible") {
        lastTick = now;
        return;
      }
      const elapsed = Math.min(Math.floor((now - lastTick) / 1000), 5);
      lastTick = now;
      if (elapsed <= 0) return;

      let changed = false;
      quests.forEach(quest => {
        if (quest.type === "time_on_site" && !isClaimed(quest)) {
          setProgress(quest, questProgress(quest) + elapsed);
          updateQuestCard(quest);
          changed = true;
        }
      });

      if (changed) {
        secondsSinceSave += elapsed;
        if (secondsSinceSave >= 10) {
          secondsSinceSave = 0;
          save();
        }
      }
    }, 1000);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        save();
        secondsSinceSave = 0;
      } else {
        lastTick = Date.now();
      }
    });
    window.addEventListener("pagehide", save);
  }

  function renderQuests() {
    const container = document.getElementById("quest-list");
    if (!container) return;
    container.replaceChildren();

    quests.forEach(quest => {
      const card = document.createElement("article");
      card.className = "quest-card";
      card.dataset.questId = quest.id;

      const top = document.createElement("div");
      top.className = "quest-card-top";
      const frequency = document.createElement("span");
      frequency.className = "quest-frequency";
      frequency.textContent = quest.frequency === "once" ? "ONE-TIME" : "DAILY";
      const stateLabel = document.createElement("span");
      stateLabel.dataset.questState = "";
      const heading = document.createElement("h3");
      heading.textContent = quest.title;
      const description = document.createElement("p");
      description.textContent = quest.description;
      const progressLine = document.createElement("div");
      progressLine.className = "quest-progress-line";
      const progress = document.createElement("span");
      progress.dataset.questProgress = "";
      const progressTrack = document.createElement("div");
      progressTrack.className = "progress-track";
      progressTrack.setAttribute("role", "progressbar");
      progressTrack.setAttribute("aria-label", quest.title + " progress");
      progressTrack.setAttribute("aria-valuemin", "0");
      progressTrack.setAttribute("aria-valuemax", String(quest.target));
      const progressFill = document.createElement("span");
      progressFill.className = "progress-fill";
      progressFill.dataset.progressFill = "";
      progressTrack.append(progressFill);
      progressLine.append(progress);
      top.append(frequency, stateLabel);
      const reward = document.createElement("strong");
      reward.className = "quest-reward";
      reward.textContent = "+" + quest.reward + " BB";
      const button = document.createElement("button");
      button.addEventListener("click", () => {
        if (questProgress(quest) < quest.target || isClaimed(quest)) return;
        bucketFor(quest).claimed[quest.id] = true;
        state.balance += quest.reward;
        state.lifetimeEarned += quest.reward;
        save();
        updateQuestCards();
        renderShop();
        renderAchievements();
      });

      card.append(top, heading, description, progressLine, progressTrack, reward, button);
      container.append(card);
      updateQuestCard(quest);
    });
  }

  function renderShop() {
    const container = document.getElementById("shop-list");
    if (!container) return;
    container.replaceChildren();

    shop.forEach(item => {
      const owned = state.inventory.includes(item.id);
      const active = state.activeItem === item.id;
      const card = document.createElement("article");
      card.className = "shop-card";
      const top = document.createElement("div");
      top.className = "shop-card-top";
      const status = document.createElement("span");
      status.className = "shop-status" + (active ? " equipped" : owned ? " owned" : "");
      status.textContent = active ? "Equipped" : owned ? "Owned" : "IN THE SHOP";
      const heading = document.createElement("h3");
      heading.textContent = item.name;
      const description = document.createElement("p");
      description.textContent = item.description;
      const price = document.createElement("strong");
      price.className = "shop-price";
      price.textContent = item.price + " BB";
      const button = document.createElement("button");
      button.textContent = active ? "Currently equipped" : owned ? "Equip item" : "Buy for " + item.price + " BB";
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
      top.append(status);
      card.append(top, heading, description, price, button);
      container.append(card);
    });
  }

  function renderAchievements() {
    const container = document.getElementById("achievement-list");
    if (!container) return;
    container.replaceChildren();

    achievements.forEach(item => {
      const unlocked = state.lifetimeEarned >= item.totalEarned;
      const card = document.createElement("article");
      card.className = "achievement-card" + (unlocked ? " unlocked" : "");
      const heading = document.createElement("h3");
      heading.textContent = item.name;
      const description = document.createElement("p");
      description.textContent = item.description;
      const status = document.createElement("span");
      status.className = "achievement-status" + (unlocked ? " unlocked" : "");
      status.textContent = unlocked ? "Unlocked" : item.totalEarned + " BB lifetime goal";
      const progressTrack = document.createElement("div");
      progressTrack.className = "progress-track";
      const progressFill = document.createElement("span");
      progressFill.className = "progress-fill";
      progressFill.style.width = Math.min(100, (state.lifetimeEarned / item.totalEarned) * 100) + "%";
      progressTrack.append(progressFill);
      card.append(heading, description, status, progressTrack);
      container.append(card);
    });
  }

  async function init() {
    updateBalance();
    try {
      const response = await fetch("/quests.json");
      if (!response.ok) throw new Error("Could not load quests.json");
      const config = await response.json();
      quests = Array.isArray(config.quests) ? config.quests : [];
      shop = Array.isArray(config.shop) ? config.shop : [];
      achievements = Array.isArray(config.achievements) ? config.achievements : [];
      recordPageVisit();
      document.addEventListener("click", recordLinkClick);
      renderQuests();
      renderShop();
      renderAchievements();
      startTimeTracking();
    } catch (error) {
      const container = document.getElementById("quest-list");
      if (container) container.textContent = "Couldn't load quests.json.";
      console.error(error);
    }
  }

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      updateBalance();
      updateQuestCards();
      renderShop();
      renderAchievements();
    }
  });

  init();
})();
