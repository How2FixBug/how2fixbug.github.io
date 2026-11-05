/*
  ADD PROJECTS HERE.

  Copy this example, change the details, and add it inside the [ ] below:

  {
    title: "My project",
    description: "A short description of what it does.",
    url: "https://example.com",
    category: "Game"
  }

  The category is optional. Use url: "" if the project has no public link yet.
*/

const projects = [
  {
    title: "Clickstronomy",
    description: "Click the asteroid to gain matter. Buy upgrades, and even fight the sun! Also, discontinued.",
    url: "https://scratch.mit.edu/projects/1258035545/",
    category: "Game"
  }
  {
    title: "Clickstronomy 2",
    description: "Buy upgrades to unlock clickers, upgrades to clickers, automation, and more!! Also, discontinued.",
    url: "https://scratch.mit.edu/projects/1379867279/",
    category: "Game"
  }
];

const projectList = document.querySelector("#project-list");

if (projects.length === 0) {
  const empty = document.createElement("p");
  empty.className = "empty-projects";
  empty.textContent = "Projects coming soon!";
  projectList.append(empty);
}

for (const project of projects) {
  const card = document.createElement(project.url ? "a" : "article");
  card.className = "project-card";

  if (project.url) {
    card.href = project.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
  }

  const title = document.createElement("h2");
  title.textContent = project.title || "Untitled project";
  card.append(title);

  const description = document.createElement("p");
  description.textContent = project.description || "";
  card.append(description);

  if (project.category) {
    const category = document.createElement("span");
    category.className = "project-tag";
    category.textContent = project.category;
    card.append(category);
  }

  projectList.append(card);
}
