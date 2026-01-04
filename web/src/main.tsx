import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import RootLayout from "./routes/root-layout";
import InboxRoute, { inboxLoader, inboxAction } from "./routes/inbox.route";
import ProjectRoute, { projectLoader, projectAction } from "./routes/project.route";



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
