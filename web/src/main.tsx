import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import RootLayout from "./routes/root-layout";
import InboxRoute, { inboxLoader, inboxAction } from "./routes/inbox.route";
import ProjectRoute, { projectLoader, projectAction } from "./routes/project.route";
import CompletedRoute, { completedLoader } from "./routes/completed.route";
import BoardPage from "./pages/BoardPage";
import LivePage from "./pages/LivePage";
import WorldPage from "./pages/WorldPage";
import QuestsPage from "./pages/QuestsPage";
import ProjectsPage from "./pages/ProjectsPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        loader: inboxLoader,
        action: inboxAction,
        Component: InboxRoute,
      },
      {
        path: "project/:name",
        loader: projectLoader,
        action: projectAction,
        Component: ProjectRoute,
      },
      {
        path: "completed",
        loader: completedLoader,
        Component: CompletedRoute,
      },
      {
        path: "quests",
        Component: QuestsPage,
      },
      {
        path: "live",
        Component: LivePage,
      },
      {
        path: "world",
        Component: WorldPage,
      },
      {
        path: "projects",
        Component: ProjectsPage,
      },
      {
        path: "board",
        Component: BoardPage,
      },
    ],
  },
]);

let root = document.getElementById("root");
if (!root) {
  root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
